"""Nạp dữ liệu vận hành cho môi trường phát triển, đi qua API thật để đúng mọi luật nghiệp vụ
(sổ kho, hạn mức, mã tự sinh, duyệt phiếu...). Chạy sau `go run ./cmd/seed` và khi backend đang chạy.

    python backend/scripts/seed_operational.py

Chỉ dùng cho DB dev trên máy này (localhost). Xem phần cuối file để biết cách tạo lại từ đầu.
"""
import hashlib
import json
import os
import random
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta, timezone

# Biến môi trường (server): SEED_API, SEED_PASSWORD, SEED_EDGE_KEY_PREFIX, SEED_PSQL (lệnh psql, ví dụ
# "docker compose exec -T postgres psql -U user -d db"). Không đặt thì dùng cấu hình máy dev.
BASE = os.environ.get('SEED_API', 'http://localhost:8080')
API = f'{BASE}/v1'
EDGE = f'{BASE}/edge/v1'
SEED_PASSWORD = os.environ.get('SEED_PASSWORD')
PSQL_CMD = os.environ.get('SEED_PSQL')
EDGE_PREFIX = os.environ.get('SEED_EDGE_KEY_PREFIX', 'edge_key')
MANAGER = ('admin@petrovn.vn', SEED_PASSWORD or 'Admin@123456')
ACCOUNTANT = ('ketoan@petrovn.vn', SEED_PASSWORD or 'Accountant@123456')
STATION_MANAGERS = {  # quản lý từng trạm (chỉ thấy trạm của mình)
    'CG': ('thang.td@petrovn.vn', SEED_PASSWORD or 'Manager@123456'),
    'HP': ('huy.dq@petrovn.vn', SEED_PASSWORD or 'Manager@123456'),
    'DN': ('huong.vtt@petrovn.vn', SEED_PASSWORD or 'Manager@123456'),
}
EDGE_KEYS = {  # trùng với cmd/seed/main.go
    'CG': f'{EDGE_PREFIX}_cau_giay',
    'HP': f'{EDGE_PREFIX}_hai_phong',
    'DN': f'{EDGE_PREFIX}_da_nang',
}
random.seed(20261121)
NOW = datetime.now(timezone.utc).replace(microsecond=0)


def iso(dt):
    return dt.strftime('%Y-%m-%dT%H:%M:%SZ')


def curl(method, url, body=None, headers=None, jar=None):
    cmd = ['curl', '-s', '-X', method, url, '-H', 'Content-Type: application/json', '-w', '\n%{http_code}']
    if jar:
        cmd += ['-b', jar, '-c', jar]
    for k, v in (headers or {}).items():
        cmd += ['-H', f'{k}: {v}']
    if body is not None:
        cmd += ['-d', json.dumps(body)]
    out = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8').stdout
    raw, _, code = out.rpartition('\n')
    try:
        data = json.loads(raw) if raw.strip() else None
    except ValueError:
        data = raw
    return int(code or 0), data


class Session:
    def __init__(self, email, password):
        fd, self.jar = tempfile.mkstemp(suffix='.cookies')
        os.close(fd)
        status, body = curl('POST', f'{API}/auth/login', {'username': email, 'password': password, 'remember_me': False}, jar=self.jar)
        if status != 200:
            sys.exit(f'Đăng nhập {email} thất bại: {status} {body}')

    def call(self, method, path, body=None, ok=(200, 201)):
        status, data = curl(method, f'{API}{path}', body, jar=self.jar)
        if status not in ok:
            sys.exit(f'{method} {path} => {status}: {data}\nbody: {json.dumps(body, ensure_ascii=False)[:400]}')
        return data


def psql(sql):
    """Chạy SQL qua stdin (tránh lỗi mã hóa tiếng Việt trên dòng lệnh Windows)."""
    command = PSQL_CMD.split() if PSQL_CMD else ['psql', '-h', 'localhost', '-U', 'postgres', '-d', 'fuel_station_db']
    out = subprocess.run(
        command + ['-At', '-F', '|', '-v', 'ON_ERROR_STOP=1'],
        input=sql, capture_output=True, text=True, encoding='utf-8',
        env={**os.environ, 'PGPASSWORD': 'postgres', 'PGCLIENTENCODING': 'UTF8'},
    )
    if out.returncode != 0:
        sys.exit(f'psql lỗi: {out.stderr}')
    return [line.split('|') for line in out.stdout.strip().splitlines() if line and not line.startswith(('INSERT', 'UPDATE', 'SET'))]


def items(body):
    if isinstance(body, dict):
        for key in ('items', 'data'):
            if isinstance(body.get(key), list):
                return body[key]
    return body


# ------------------------------------------------------------------------------------------------
# Dữ liệu mô tả
# ------------------------------------------------------------------------------------------------
FUELS = [('A95', 'Xăng RON 95-III'), ('E5', 'Xăng E5 RON 92-II'), ('DO', 'Dầu DO 0,05S-II')]
VEHICLE_TYPES = [('TRUCK', 'Xe tải'), ('TANKER', 'Xe bồn'), ('PICKUP', 'Xe bán tải')]

# trạm -> (tên viết tắt trong mã bể, danh sách bể: nhiên liệu, dung tích L, tồn đầu L, số trụ)
STATION_TANKS = {
    'Trạm xăng Cầu Giấy': ('CG', [('A95', 40000, 26500, 2), ('E5', 30000, 18200, 1), ('DO', 50000, 33800, 2)]),
    'Trạm xăng Hải Phòng': ('HP', [('DO', 60000, 41500, 2), ('A95', 40000, 22800, 2), ('E5', 25000, 14600, 1)]),
    'Trạm xăng Đà Nẵng': ('DN', [('A95', 40000, 31200, 2), ('E5', 25000, 9800, 1), ('DO', 50000, 7400, 1)]),
}

SUPPLIERS = [
    ('NCC001', 'Công ty CP Vận tải Xăng dầu Đại Phát', '0243 8264 119', 'Số 18 Phạm Hùng, Nam Từ Liêm, Hà Nội'),
    ('NCC002', 'Công ty TNHH Thương mại Xăng dầu Hòa Bình', '0225 3920 346', 'Khu công nghiệp Đình Vũ, Hải Phòng'),
    ('NCC003', 'Công ty CP Xăng dầu Miền Trung', '0236 3841 702', 'Số 52 Ngô Quyền, Sơn Trà, Đà Nẵng'),
]

# (biển số, loại, nhiên liệu, các trạm được đổ, ghi chú, định mức L/ngày)
VEHICLES = [
    ('29C-124.56', 'TRUCK', 'DO', ['CG', 'HP'], 'Xe tải 8 tấn chạy tuyến Hà Nội - Hải Phòng', 250),
    ('29C-318.07', 'TRUCK', 'DO', ['CG', 'HP'], 'Xe tải 15 tấn', 300),
    ('30F-562.91', 'TANKER', 'DO', ['CG'], 'Xe bồn chở nước', 220),
    ('29H-077.43', 'PICKUP', 'DO', ['CG'], 'Xe bán tải của đội kỹ thuật', 80),
    ('30A-945.28', 'PICKUP', 'A95', ['CG'], 'Xe công vụ', 60),
    ('15C-203.64', 'TRUCK', 'DO', ['HP'], 'Xe tải container', 350),
    ('15C-411.30', 'TRUCK', 'DO', ['HP', 'CG'], 'Xe tải 10 tấn', 280),
    ('15A-886.12', 'PICKUP', 'A95', ['HP'], 'Xe bán tải', 70),
    ('15H-102.58', 'TANKER', 'E5', ['HP'], 'Xe bồn nội bộ', 90),
    ('43C-157.83', 'TRUCK', 'DO', ['DN'], 'Xe tải 9 tấn', 260),
    ('43C-290.46', 'TRUCK', 'DO', ['DN'], 'Xe tải 12 tấn', 300),
    ('43A-731.05', 'PICKUP', 'A95', ['DN'], 'Xe công vụ', 60),
    ('43H-064.97', 'PICKUP', 'E5', ['DN', 'CG'], 'Xe bán tải', 70),
]

DRIVERS = [
    ('TX0101', 'Nguyễn Văn Hùng', '0912 440 218', 'Đội vận tải 1'),
    ('TX0102', 'Trần Quốc Việt', '0903 117 562', 'Đội vận tải 1'),
    ('TX0103', 'Lê Minh Đức', '0988 301 744', 'Đội vận tải 1'),
    ('TX0104', 'Phạm Hồng Quân', '0935 826 109', 'Đội kỹ thuật'),
    ('TX0201', 'Đặng Văn Tú', '0976 215 833', 'Đội vận tải 2'),
    ('TX0202', 'Bùi Xuân Trường', '0904 662 371', 'Đội vận tải 2'),
    ('TX0203', 'Vũ Đình Khoa', '0918 553 029', 'Đội vận tải 2'),
    ('TX0301', 'Hoàng Anh Tuấn', '0943 778 215', 'Đội vận tải 3'),
    ('TX0302', 'Võ Thanh Sơn', '0971 304 668', 'Đội vận tải 3'),
    ('TX0303', 'Phan Công Thành', '0912 884 097', 'Đội kỹ thuật'),
]


def card_number(seed_text):
    """Số thẻ NFC 10 chữ số, ổn định theo nội dung."""
    return str(int(hashlib.sha1(seed_text.encode()).hexdigest()[:8], 16) % 9_000_000_000 + 1_000_000_000)


def main():
    admin = Session(*MANAGER)
    accountant = Session(*ACCOUNTANT)
    managers = {short: Session(*cred) for short, cred in STATION_MANAGERS.items()}

    branches = {b['name']: b for b in items(admin.call('GET', '/assets/branches?page_size=100'))}
    short_of = {}  # branch_id -> CG/HP/DN
    for name, (short, _) in STATION_TANKS.items():
        short_of[branches[name]['id']] = short
    branch_by_short = {short_of[b['id']]: b for b in branches.values()}

    # ---- Danh mục: nhiên liệu (API), loại xe (không có API nên chèn thẳng)
    fuel_id = {}
    for code, name in FUELS:
        fuel_id[code] = admin.call('POST', '/assets/fuel-types', {'code': code, 'name': name})['id']
    for code, name in VEHICLE_TYPES:
        psql(f"INSERT INTO station.vehicle_type (tenant_id, code, name, active) SELECT id, '{code}', '{name}', true FROM station.tenant LIMIT 1 ON CONFLICT DO NOTHING")
    vtype_id = {r[0]: r[1] for r in psql('SELECT code, id FROM station.vehicle_type')}

    # ---- Bể + trụ
    tanks = []   # dict: id, branch short, fuel
    pumps = []   # dict: id, edge_pump_id, tank, branch short
    for name, (short, spec) in STATION_TANKS.items():
        branch = branches[name]
        com = 3
        pump_no = 1
        for fuel, capacity_l, opening_l, pump_count in spec:
            tank = admin.call('POST', '/assets/tanks', {
                'branch_id': branch['id'], 'code': f'BE-{short}-{fuel}', 'name': f'Bể {fuel} số 1',
                'fuel_type_id': fuel_id[fuel], 'design_capacity_ml': capacity_l * 1000,
                'max_usable_capacity_ml': int(capacity_l * 0.95) * 1000, 'low_stock_threshold_ml': int(capacity_l * 0.12) * 1000,
                'loss_tolerance_pct': 0.5, 'opening_stock_ml': opening_l * 1000,
            })
            tanks.append({'id': tank['id'], 'short': short, 'fuel': fuel, 'branch_id': branch['id'], 'capacity_l': capacity_l})
            for _ in range(pump_count):
                pump = admin.call('POST', '/assets/pumps', {
                    'branch_id': branch['id'], 'tank_id': tank['id'], 'name': f'Trụ {pump_no:02d} - {fuel}',
                    'sensor_com_port': f'COM{com}', 'terminal_host': f'192.168.10.{10 + pump_no}',
                })
                pumps.append({'id': pump['id'], 'edge_pump_id': pump['edge_pump_id'], 'tank': tanks[-1], 'short': short,
                              'name': pump['name'], 'total_ml': random.randint(80_000, 420_000) * 1000})
                com += 1
                pump_no += 1
    print(f'Đã tạo {len(tanks)} bể, {len(pumps)} trụ bơm')

    # ---- Nhà cung cấp
    supplier_id = []
    for code, name, phone, address in SUPPLIERS:
        supplier_id.append(admin.call('POST', '/inventory/suppliers', {'code': code, 'name': name, 'phone': phone, 'address': address})['id'])

    # ---- Xe + tài xế + định mức
    vehicles = []
    # `shorts` chỉ để mô phỏng xe hay đổ ở trạm nào khi sinh giao dịch; xe là dữ liệu cấp công ty, không gửi lên API.
    for plate, vtype, fuel, shorts, note, quota_l in VEHICLES:
        v = admin.call('POST', '/master/vehicles', {
            'plate': plate, 'vehicle_type_id': vtype_id[vtype], 'fuel_type_id': fuel_id[fuel],
            'note': note, 'card_number': card_number('xe' + plate),
        })
        vehicles.append({'id': v['id'], 'code': v['code'], 'plate': plate, 'fuel': fuel, 'shorts': shorts, 'quota_l': quota_l,
                         'card': card_number('xe' + plate)})
        admin.call('POST', '/quotas/rules', {
            'target_type': 'vehicle', 'target_id': v['id'], 'period': 'day', 'max_volume_liters': quota_l,
            'min_interval_minutes': 30, 'effective_from': (NOW - timedelta(days=40)).strftime('%Y-%m-%d'),
        })
    drivers = []
    for code, name, phone, dept in DRIVERS:
        d = admin.call('POST', '/master/drivers', {
            'code': code, 'full_name': name, 'phone': phone, 'department': dept, 'status': 'active',
            'card_number': card_number('tx' + code),
        })
        drivers.append({'id': d['id'], 'code': code, 'name': name, 'card': card_number('tx' + code), 'prefix': code[2:4]})
    print(f'Đã tạo {len(vehicles)} xe, {len(drivers)} tài xế, {len(vehicles)} quy tắc định mức')

    # ---- Phiếu nhập: các đợt nhập trong 2 tuần qua đã duyệt, thêm phiếu chờ duyệt và bản nháp
    def make_receipt(tank, liters, days_ago, supplier, plate, doc, approve):
        """Quản lý trạm lập phiếu, quản lý khác (ngoài người lập) duyệt: DB cấm tự duyệt phiếu của mình."""
        short = tank['short']
        creator = managers[short] if short == 'CG' else admin
        approver = admin if short == 'CG' else managers[short]
        received = NOW - timedelta(days=days_ago, hours=random.randint(0, 5))
        rc = creator.call('POST', '/inventory/receipts', {
            'branch_id': tank['branch_id'], 'received_at': iso(received), 'supplier_id': supplier,
            'tanker_plate': plate, 'document_no': doc,
            'lines': [{'tank_id': tank['id'], 'fuel_type_id': fuel_id[tank['fuel']],
                       'document_volume_ml': liters * 1000, 'actual_volume_ml': (liters - random.randint(0, 40)) * 1000}],
        })
        if approve is None:
            return rc
        creator.call('POST', f"/inventory/receipts/{rc['id']}/submit")
        if approve:
            approver.call('POST', f"/inventory/receipts/{rc['id']}/approve", {'approved': True})
        return rc

    by_key = {(t['short'], t['fuel']): t for t in tanks}
    plan = [  # (trạm, nhiên liệu, lít, số ngày trước, nhà cung cấp, biển xe bồn, số chứng từ)
        ('CG', 'DO', 12000, 11, 0, '29H-408.15', 'HĐ-0412/26'), ('CG', 'A95', 8000, 8, 0, '29H-516.20', 'HĐ-0431/26'),
        ('CG', 'E5', 6000, 4, 0, '29H-408.15', 'HĐ-0466/26'), ('HP', 'DO', 15000, 12, 1, '15H-233.74', 'HĐ-1105/26'),
        ('HP', 'A95', 9000, 6, 1, '15H-233.74', 'HĐ-1139/26'), ('DN', 'A95', 5000, 9, 2, '43H-318.02', 'HĐ-0870/26'),
        ('DN', 'E5', 7000, 5, 2, '43H-318.02', 'HĐ-0902/26'), ('DN', 'DO', 8000, 2, 2, '43H-455.61', 'HĐ-0933/26'),
    ]
    for short, fuel, liters, days, sup, plate, doc in plan:
        make_receipt(by_key[(short, fuel)], liters, days, supplier_id[sup], plate, doc, approve=True)
    make_receipt(by_key[('HP', 'E5')], 6000, 0, supplier_id[1], '15H-233.74', 'HĐ-1163/26', approve=False)   # chờ duyệt
    make_receipt(by_key[('CG', 'DO')], 10000, 0, supplier_id[0], '29H-408.15', 'HĐ-0488/26', approve=None)  # bản nháp
    print('Đã tạo phiếu nhập (8 đã duyệt, 1 chờ duyệt, 1 nháp)')

    # ---- Phiên đổ + lượt xác thực do Edge Agent đẩy lên
    sale_seq = {p['id']: 0 for p in pumps}
    remaining_l = {t['id']: 0 for t in tanks}  # chỉ để không đổ quá tồn: lấy từ sổ kho
    for row in psql('SELECT tank_id, stock_ml FROM station.tank_stock'):
        remaining_l[row[0]] = int(row[1]) // 1000

    edge_ref = 0
    accepted = rejected = 0
    for day in range(13, -1, -1):
        for short in ('CG', 'HP', 'DN'):
            key = EDGE_KEYS[short]
            headers = {'X-Api-Key': key}
            station_vehicles = [v for v in vehicles if short in v['shorts']]
            sessions_today = random.randint(6, 12)
            for _ in range(sessions_today):
                v = random.choice(station_vehicles)
                candidates = [p for p in pumps if p['short'] == short and p['tank']['fuel'] == v['fuel']]
                if not candidates:
                    continue
                pump = random.choice(candidates)
                tank = pump['tank']
                liters = min(max(15, int(random.gauss(v['quota_l'] / 3, v['quota_l'] / 10))), v['quota_l'])
                # Giữ lại ít nhất 3% dung tích để bể không cạn
                if remaining_l[tank['id']] - liters < tank['capacity_l'] * 0.03:
                    continue
                driver_pool = [d for d in drivers if d['prefix'] in ('01', '02', '03')] if short != 'DN' else [d for d in drivers if d['prefix'] == '03']
                driver = random.choice(driver_pool)
                started = NOW - timedelta(days=day, hours=random.randint(0, 11), minutes=random.randint(0, 59))
                if started > NOW:
                    started = NOW - timedelta(minutes=random.randint(5, 90))
                finished = started + timedelta(minutes=random.randint(2, 9))
                paired = started - timedelta(seconds=random.randint(20, 60))
                edge_ref += 1
                sale_seq[pump['id']] += 1
                pump['total_ml'] += liters * 1000
                result = random.random()
                status, edge_state, dispensed = 'completed', 'completed', liters * 1000
                if result > 0.96:
                    status, edge_state, dispensed = 'cancelled', 'timed_out', 0
                elif result > 0.93:
                    status, edge_state = 'failed', 'enable_failed'
                    dispensed = 0
                code, _ = curl('POST', f'{EDGE}/dispense-sessions', {
                    'edge_ref': f'{short}-{edge_ref:06d}', 'pump_id': pump['id'], 'edge_pump_id': pump['edge_pump_id'],
                    'tank_id': tank['id'], 'fuel_type_id': fuel_id[tank['fuel']], 'sale_seq': sale_seq[pump['id']],
                    'vehicle_id': v['id'], 'vehicle_code': v['code'], 'vehicle_plate': v['plate'],
                    'driver_id': driver['id'], 'driver_code': driver['code'], 'driver_name': driver['name'],
                    'limit_ml': v['quota_l'] * 1000, 'dispensed_ml': dispensed, 'pump_total_ml': pump['total_ml'],
                    'edge_state': edge_state, 'status': status,
                    'paired_at': iso(paired), 'unlocked_at': iso(paired + timedelta(seconds=3)),
                    'started_at': iso(started), 'finished_at': iso(finished),
                    'events': [
                        {'from_state': None, 'to_state': 'paired', 'occurred_at': iso(paired)},
                        {'from_state': 'paired', 'to_state': 'dispensing', 'occurred_at': iso(started)},
                        {'from_state': 'dispensing', 'to_state': edge_state, 'occurred_at': iso(finished)},
                    ],
                }, headers=headers)
                if code not in (200, 201):
                    sys.exit(f'Phiên đổ bị từ chối ({code}) tại {short}')
                remaining_l[tank['id']] -= dispensed // 1000
                curl('POST', f'{EDGE}/access-events', [{
                    'edge_ref': f'{short}-ev-{edge_ref:06d}', 'occurred_at': iso(paired), 'kind': 'credential',
                    'pump_id': pump['id'], 'method': 'card', 'external_id': v['card'], 'vehicle_id': v['id'],
                    'driver_id': driver['id'], 'party_name': v['plate'], 'decision': 'accept',
                }], headers=headers)
                accepted += 1
            # vài lượt quẹt bị từ chối mỗi ngày
            for _ in range(random.randint(0, 2)):
                edge_ref += 1
                reason = random.choice(['UnknownCard', 'NoQuota', 'Expired'])
                curl('POST', f'{EDGE}/access-events', [{
                    'edge_ref': f'{short}-ev-{edge_ref:06d}', 'occurred_at': iso(NOW - timedelta(days=day, hours=random.randint(0, 11))),
                    'kind': 'credential', 'method': 'card', 'external_id': card_number(f'la{edge_ref}'),
                    'decision': 'reject', 'reason': reason,
                }], headers=headers)
                rejected += 1
    for short, key in EDGE_KEYS.items():
        curl('POST', f'{EDGE}/heartbeat', {'pending_queue': 0, 'agent_version': '1.0.0'}, headers={'X-Api-Key': key})
    print(f'Đã tạo {accepted} phiên đổ và {rejected} lượt quẹt bị từ chối')

    # ---- Phiếu xuất điều chỉnh: hao hụt đã duyệt, kiểm tra đã duyệt, thêm phiếu chờ duyệt
    def make_issue(tank, kind, liters, reason, approve):
        issue = admin.call('POST', '/inventory/issues', {
            'branch_id': tank['branch_id'], 'kind': kind, 'tank_id': tank['id'], 'volume_liters': liters, 'reason': reason,
        })
        if approve is None:
            return
        admin.call('POST', f"/inventory/issues/{issue['id']}/submit")
        if approve:
            accountant.call('POST', f"/inventory/issues/{issue['id']}/approve", {'approved': True})

    make_issue(by_key[('CG', 'DO')], 'loss', 85, 'Hao hụt do bay hơi và đo lường cuối tháng', True)
    make_issue(by_key[('HP', 'DO')], 'inspection', 40, 'Xuất mẫu kiểm định chất lượng theo yêu cầu cơ quan quản lý', True)
    make_issue(by_key[('DN', 'A95')], 'loss', 60, 'Hao hụt khi súc rửa đường ống trụ 01', None)
    make_issue(by_key[('CG', 'A95')], 'inspection', 25, 'Lấy mẫu A95 kiểm tra chỉ số octan', False)
    print('Đã tạo phiếu xuất điều chỉnh')

    # ---- Kiểm kê hôm qua: đo que thăm, kế toán xác nhận một phần
    yesterday = (NOW - timedelta(days=1)).strftime('%Y-%m-%d')
    stock_now = {r[0]: int(r[1]) for r in psql('SELECT tank_id, stock_ml FROM station.tank_stock')}
    for i, tank in enumerate(tanks):
        rec = admin.call('POST', '/inventory/stocktake', {'branch_id': tank['branch_id'], 'tank_id': tank['id'], 'period_date': yesterday})
        if i % 3 == 2:
            continue  # để vài kỳ chưa đo
        book_ml = rec.get('book_closing_ml') or stock_now[tank['id']]
        drift = random.choice([-0.0015, 0.0008, -0.0004, 0.0012, -0.0031 if i == 4 else 0.0003])
        measured = int(book_ml * (1 + drift))
        admin.call('PUT', f"/inventory/stocktake/{rec['id']}/measure", {'measured_ml': measured, 'pump_totalizer_ml': max(0, book_ml - 5000), 'note': 'Đo bằng que thăm cuối ca'})
        if i % 3 == 0:
            accountant.call('POST', f"/inventory/stocktake/{rec['id']}/confirm", {'adjust_ledger': False, 'note': 'Chênh lệch trong dung sai, chốt sổ'})
    print('Đã tạo kiểm kê')

    # ---- Chỉnh mốc thời gian sổ kho cho khớp lịch sử (số dư đầu kỳ cách đây 14 ngày, phiếu nhập theo ngày nhận)
    psql(f"""
        SET session_replication_role = replica;
        UPDATE station.stock_ledger SET occurred_at = now() - interval '14 days' WHERE kind = 'opening';
        UPDATE station.stock_ledger l SET occurred_at = r.received_at
          FROM station.stock_receipt r WHERE l.kind = 'receipt' AND l.ref_id = r.id;
        UPDATE station.tank SET created_at = now() - interval '14 days';
    """)
    print('Hoàn tất. Tài khoản: admin@petrovn.vn / ketoan@petrovn.vn / it@petrovn.vn (mật khẩu trong cmd/seed/main.go)')


if __name__ == '__main__':
    main()

# Tạo lại từ đầu: xem backend/scripts/reset_dev_data.sql.
