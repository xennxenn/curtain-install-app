import React from 'react';
import { AutoFitText } from './AutoFitText';
import { optImg } from '../utils';

interface InfoCardProps {
  title: string;
  imgUrl: string | null | undefined;
  text1: string;
  text2?: string;
  isDim?: boolean;
}

export const InfoCard: React.FC<InfoCardProps> = React.memo(({ title, imgUrl, text1, text2, isDim = false }) => (
  <div className={`flex flex-col items-center bg-white border border-gray-200 p-1.5 sm:p-2 rounded shadow-sm h-full justify-between overflow-hidden ${isDim ? 'opacity-40 print:opacity-50' : ''}`}>
    <span className="text-[11px] sm:text-[13px] font-bold text-gray-800 w-full text-center mb-1 sm:mb-2 shrink-0">{title}</span>
    <div className="flex-1 w-full border border-gray-100 flex items-center justify-center rounded overflow-hidden bg-gray-50 p-0 relative mb-1 sm:mb-2">
      {imgUrl ? (
        <img src={optImg(imgUrl, 400)} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <span className="text-[10px] text-gray-400">-</span>
      )}
    </div>
    <AutoFitText text={text1 || '-'} className="text-blue-800 print:text-black" />
  </div>
));

InfoCard.displayName = 'InfoCard';
