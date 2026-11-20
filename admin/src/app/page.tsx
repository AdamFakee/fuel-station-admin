import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DetailPageHeader } from '@/components/detail-page-header';
import { Empty } from '@/components/empty';
import {
  SparklesIcon,
  CheckCircleIcon,
  ServerStackIcon,
  PaintBrushIcon,
  CubeIcon,
  CommandLineIcon,
} from '@heroicons/react/24/outline';

export default function HomePage() {
  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Detail Page Header shell from skills */}
      <DetailPageHeader
        title="Fuel Station Admin Base"
        description="Khung dự án chuẩn (Clean Starter Base) - Kiến trúc Golang Modular Monolith & Next.js App Router"
        badge={
          <Badge variant="outline" className="border-primary/40 text-primary">
            v1.0.0 Ready
          </Badge>
        }
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            Tài liệu hướng dẫn
          </Button>
          <Button size="sm">
            <SparklesIcon className="mr-1.5 h-4 w-4" />
            Khởi tạo module mới
          </Button>
        </div>
      </DetailPageHeader>

      {/* Feature / Architecture Highlights */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-xs hover:border-primary/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Backend Architecture</CardTitle>
            <ServerStackIcon className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Golang</div>
            <p className="text-xs text-muted-foreground mt-1">
              Modular Monolith, Chi router, pgxpool & slog
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs hover:border-primary/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Design System</CardTitle>
            <PaintBrushIcon className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Tailwind v4</div>
            <p className="text-xs text-muted-foreground mt-1">
              Brand xanh xám, CSS tokens & 30+ UI primitives
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs hover:border-primary/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Deep Modules</CardTitle>
            <CubeIcon className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Feature Sliced</div>
            <p className="text-xs text-muted-foreground mt-1">
              1 File = 1 API, TanStack Query v5 & Zod
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs hover:border-primary/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Agent Integration</CardTitle>
            <CommandLineIcon className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">10+ Skills</div>
            <p className="text-xs text-muted-foreground mt-1">
              Quy chuẩn P0, AGENTS.md router & Skills đồng bộ
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Guide Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quy chuẩn Thiết kế Frontend</CardTitle>
            <CardDescription>
              Cấu trúc thư mục và nguyên tắc phát triển giao diện
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <CheckCircleIcon className="h-5 w-5 text-success shrink-0 mt-0.5" />
              <span>
                <strong>1 File = 1 API Endpoint:</strong> Đóng gói Schema Zod, QueryKey, Fetcher và Hook trong cùng 1 file độc lập.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircleIcon className="h-5 w-5 text-success shrink-0 mt-0.5" />
              <span>
                <strong>CRUD Popup / Drawer:</strong> Thực hiện thêm/sửa/xem chi tiết trên Sheet hoặc Dialog, tránh chuyển trang không cần thiết.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircleIcon className="h-5 w-5 text-success shrink-0 mt-0.5" />
              <span>
                <strong>Table Format Chuẩn:</strong> Căn trái cho chuỗi văn bản, căn phải cho số tiền/số lượng, định dạng ngày tháng VN.
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quy chuẩn Backend Golang</CardTitle>
            <CardDescription>
              Kiến trúc Modular Monolith và bảo mật P0
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <CheckCircleIcon className="h-5 w-5 text-success shrink-0 mt-0.5" />
              <span>
                <strong>Multi-Tenant Isolation:</strong> Mọi truy vấn database bắt buộc cô lập theo tenant trích xuất từ Context.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircleIcon className="h-5 w-5 text-success shrink-0 mt-0.5" />
              <span>
                <strong>Định danh Kép:</strong> Sử dụng UUIDv4 cho khóa chính và máy tính, dùng Code thân thiện cho người dùng.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircleIcon className="h-5 w-5 text-success shrink-0 mt-0.5" />
              <span>
                <strong>An toàn tiền tệ:</strong> Lưu trữ tiền dưới dạng đơn vị nhỏ nhất int64 hoặc Decimal, tuyệt đối không dùng float.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Empty State Showcase */}
      <Card>
        <CardContent className="pt-6">
          <Empty
            title="Chưa có dữ liệu nghiệp vụ"
            description="Source base này đã sẵn sàng để bạn thêm các tính năng quản lý trạm xăng (Fuel Station) như Vòi bơm, Bồn chứa, Ca bán hàng, Đồng hồ số điện tử."
            action={
              <Button variant="outline" size="sm">
                Xem tài liệu AGENTS.md
              </Button>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
