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
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  items,
  className = '',
  isExpanded: controlledExpanded,
  onToggleExpand,
}) => {
  const [internalExpanded, setInternalExpanded] = React.useState(false);
  const expanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;

  const handleToggle = () => {
    if (onToggleExpand) {
      onToggleExpand();
    } else {
      setInternalExpanded(!internalExpanded);
    }
  };

  const displayItems = items.slice(0, 6);

  return (
    <aside
      className={`${
        expanded ? 'w-56 px-16' : 'w-16 px-12'
      } bg-bg-base border-r border-border min-h-screen flex flex-col py-16 transition-all duration-200 ease-in-out select-none shrink-0 z-20 ${className}`}
    >
      {/* Top Header: Logo + Menu Toggle */}
      <div className="flex items-center justify-between mb-24 w-full px-4">
        <div className="flex items-center gap-12 overflow-hidden">
          <div className="w-8 h-8 rounded bg-accent flex items-center justify-center text-white font-bold text-xs shrink-0">
            RG
          </div>
          {expanded && (
            <span className="text-sm font-semibold text-text-primary truncate transition-opacity duration-200">
              RevGrowth
            </span>
          )}
        </div>
        <button
          onClick={handleToggle}
          type="button"
          aria-label={expanded ? 'Collapse Sidebar' : 'Expand Sidebar'}
          title={expanded ? 'Collapse Sidebar' : 'Expand Sidebar'}
          className="p-6 rounded text-text-muted hover:bg-bg-off hover:text-text-primary transition-colors cursor-pointer shrink-0"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Nav Items */}
      <nav className="flex flex-col gap-8 w-full">
        {displayItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={item.onClick}
              title={item.label}
              type="button"
              className={`w-full h-10 rounded-lg flex items-center gap-12 px-10 transition-colors relative cursor-pointer ${
                item.active
                  ? 'bg-accent text-white font-medium'
                  : 'text-text-muted hover:bg-bg-off hover:text-text-primary'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {expanded && <span className="text-sm truncate">{item.label}</span>}
              {item.active && !expanded && (
                <span className="absolute left-0 top-2 bottom-2 w-1 bg-accent rounded-r" />
              )}
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
