import React from 'react';
import { AutoFitText } from './AutoFitText';
import { optImg } from '../utils';

interface InfoCardProps {
  title: string;
  imgUrl: string | null | undefined;
  text1: string;
  imgUrl2?: string | null | undefined;
  color2?: string | null | undefined;
  text2?: string;
  isDim?: boolean;
}

export const InfoCard: React.FC<InfoCardProps> = React.memo(({ title, imgUrl, text1, imgUrl2, color2, text2, isDim = false }) => {
  const hasSplit = imgUrl2 !== undefined || color2 !== undefined || text2 !== undefined;

  return (
    <div className={`flex flex-col items-center bg-white border border-gray-200 p-1.5 sm:p-2 rounded shadow-sm h-full justify-between overflow-hidden ${isDim ? 'opacity-40 print:opacity-50' : ''}`}>
      <span className="text-[11px] sm:text-[13px] font-bold text-gray-800 w-full text-center mb-1 sm:mb-2 shrink-0">{title}</span>
      <div className="flex-1 w-full border border-gray-100 flex items-center justify-center rounded overflow-hidden bg-gray-50 p-0 relative mb-1 sm:mb-2">
        {hasSplit ? (
          <div className="flex w-full h-full">
            {/* Left Box (Blinds Fabric) */}
            <div className="w-1/2 h-full border-r border-gray-200 relative flex items-center justify-center overflow-hidden bg-gray-50">
              {imgUrl ? (
                <img src={optImg(imgUrl, 400)} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-[10px] text-gray-400 font-bold">มู่ลี่</span>
              )}
            </div>
            {/* Right Box (Tape Fabric or Color) */}
            <div className="w-1/2 h-full relative flex items-center justify-center overflow-hidden" style={{ backgroundColor: color2 || '#F3F4F6' }}>
              {imgUrl2 ? (
                <img src={optImg(imgUrl2, 400)} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : color2 ? (
                <div className="absolute inset-0 flex items-center justify-center text-[9px] text-white font-bold bg-opacity-30 bg-black">
                  {text2 || 'เทป'}
                </div>
              ) : (
                <span className="text-[10px] text-gray-400 font-bold">เทป</span>
              )}
            </div>
          </div>
        ) : imgUrl ? (
          <img src={optImg(imgUrl, 400)} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="text-[10px] text-gray-400">-</span>
        )}
      </div>
      <div className="w-full flex flex-col items-center text-center">
        <AutoFitText text={text1 || '-'} className="text-blue-800 print:text-black font-semibold text-xs" />
        {hasSplit && text2 && (
          <span className="text-[9px] text-gray-500 font-semibold truncate max-w-full mt-0.5 leading-none">
            {text2}
          </span>
        )}
      </div>
    </div>
  );
});

InfoCard.displayName = 'InfoCard';
