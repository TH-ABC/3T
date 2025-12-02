import React from 'react';

interface StatCardProps {
  title: string;
  value: string;
  subValue?: string;
  icon?: React.ReactNode;
  bgColor: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subValue, icon, bgColor }) => {
  return (
    <div className={`${bgColor} text-white rounded-lg shadow-sm p-5 flex flex-col justify-between h-32 relative overflow-hidden`}>
      <div className="z-10">
        <h3 className="text-sm font-medium opacity-90 uppercase tracking-wide">{title}</h3>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {subValue && <p className="text-xs mt-2 opacity-80">{subValue}</p>}
      </div>
      {icon && (
        <div className="absolute right-4 bottom-4 opacity-20 transform scale-150">
          {icon}
        </div>
      )}
    </div>
  );
};

export default StatCard;
