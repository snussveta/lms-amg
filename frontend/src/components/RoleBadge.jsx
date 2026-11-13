import React from 'react';
import { Briefcase, ShieldAlert, ShieldCheck, UserCheck } from 'lucide-react';

export const RoleBadge = ({ role, className = '' }) => {
  switch (role) {
    case 'superadmin':
      return (
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FCECEB] text-[#E84C3D] border border-[#F8D3D0] shadow-2xs ${className}`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-[#E84C3D]" />
          Суперадмин
        </span>
      );
    case 'admin':
      return (
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#141414] text-white border border-[#2A2A2A] shadow-2xs ${className}`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
          Администратор
        </span>
      );
    case 'department_head':
      return (
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#141414] text-[#E84C3D] border border-[#383838] shadow-2xs ${className}`}
        >
          <Briefcase className="w-3.5 h-3.5 text-[#E84C3D]" />
          Руководитель отдела
        </span>
      );
    case 'employee':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F5F5F7] text-[#555555] border border-[#E5E7EB] ${className}`}
        >
          <UserCheck className="w-3.5 h-3.5 text-[#777777]" />
          Сотрудник
        </span>
      );
  }
};
