import React from 'react';
import type { LucideIcon } from 'lucide-react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => {
  return (
    <div
      className={`bg-bg-base border border-border rounded-card p-24 transition-shadow duration-150 hover:shadow-card-hover ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export interface BadgeProps {
  variant: 'risk' | 'success' | 'neutral';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ variant, children, className = '' }) => {
  const variantStyles = {
    risk: 'bg-badge-riskBg text-badge-riskText border-red-200',
    success: 'bg-badge-successBg text-badge-successText border-green-200',
    neutral: 'bg-badge-neutralBg text-badge-neutralText border-gray-200',
  };

  return (
    <span
      className={`inline-flex items-center px-8 py-4 rounded text-xs font-medium leading-none border ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
};

export interface StatNumberProps {
  label: string;
  value: string | number;
  delta?: {
    value: string;
    isPositive?: boolean;
    isRisk?: boolean;
  };
  subtext?: string;
  className?: string;
}

export const StatNumber: React.FC<StatNumberProps> = ({
  label,
  value,
  delta,
  subtext,
  className = '',
}) => {
  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <span className="text-text-muted text-xs font-medium uppercase tracking-wider">{label}</span>
      <div className="flex items-baseline gap-12">
        <span className="text-text-primary text-3xl font-semibold tracking-tightest leading-none font-sans">
          {value}
        </span>
        {delta && (
          <Badge
            variant={delta.isRisk ? 'risk' : delta.isPositive ? 'success' : 'neutral'}
          >
            {delta.isPositive ? `+${delta.value}` : delta.value}
          </Badge>
        )}
      </div>
      {subtext && <span className="text-text-muted text-xs mt-4">{subtext}</span>}
    </div>
  );
};

export interface SidebarItem {
  id: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  onClick?: () => void;
}

export interface SidebarProps {
  items: SidebarItem[];
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ items, className = '' }) => {
  const displayItems = items.slice(0, 6);

  return (
    <aside
      className={`w-16 bg-bg-base border-r border-border min-h-screen flex flex-col items-center py-24 gap-16 select-none ${className}`}
    >
      <div className="w-8 h-8 rounded bg-accent flex items-center justify-center text-white font-bold text-sm mb-16">
        RG
      </div>
      <nav className="flex flex-col gap-8 w-full items-center">
        {displayItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={item.onClick}
              title={item.label}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                item.active
                  ? 'bg-accent text-white'
                  : 'text-text-muted hover:bg-bg-off hover:text-text-primary'
              }`}
            >
              <Icon className="w-5 h-5" />
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

export interface DataBarProps {
  percentage: number;
  isHero?: boolean;
  className?: string;
}

export const DataBar: React.FC<DataBarProps> = ({
  percentage,
  isHero = false,
  className = '',
}) => {
  const clamped = Math.min(100, Math.max(0, percentage));
  return (
    <div className={`w-full bg-bg-off rounded-full h-2 overflow-hidden ${className}`}>
      <div
        className={`h-full rounded-full transition-all duration-300 ${
          isHero ? 'bg-accent' : 'bg-text-primary'
        }`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
};

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  action,
  className = '',
}) => {
  return (
    <div className={`flex items-center justify-between pb-16 border-b border-border mb-24 ${className}`}>
      <div>
        <h2 className="text-lg font-semibold text-text-primary tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-text-muted mt-4">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
};
