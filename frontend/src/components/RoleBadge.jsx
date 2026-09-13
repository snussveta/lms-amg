import React from 'react';
import { ShieldAlert, ShieldCheck, UserCheck } from 'lucide-react';

export const RoleBadge = ({ role, className = '' }) => {
  switch (role) {
    case 'superadmin':
      return (
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30 ${className}`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          Суперадмин
        </span>
      );
    case 'admin':
      return (
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 ${className}`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
          Администратор
        </span>
      );
    case 'employee':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700/80 ${className}`}
        >
          <UserCheck className="w-3.5 h-3.5 text-slate-400" />
          Сотрудник
        </span>
      );
  }
};
