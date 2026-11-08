import React from 'react';
import { ShieldAlert, ShieldCheck, UserCheck } from 'lucide-react';

export const RoleBadge = ({ role, className = '' }) => {
  switch (role) {
    case 'superadmin':
      return (
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FEF2F2] text-[#E30613] border border-[#FBD0D3] shadow-2xs ${className}`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-[#E30613]" />
          Суперадмин
        </span>
      );
    case 'admin':
      return (
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F0F5FA] text-[#003B73] border border-[#B8D5ED] shadow-2xs ${className}`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-[#003B73]" />
          Администратор
        </span>
      );
    case 'employee':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F4F5F7] text-[#495057] border border-[#E0E0E0] ${className}`}
        >
          <UserCheck className="w-3.5 h-3.5 text-[#6C757D]" />
          Сотрудник
        </span>
      );
  }
};
