'use client';

import * as React from 'react';
import { RoleFormPage } from '@/features/iam/components/role-form-page';

export default function EditRolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  return <RoleFormPage roleId={id} />;
}
