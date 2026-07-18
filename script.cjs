const fs = require('fs');
let content = fs.readFileSync('src/components/BookingWizard.tsx', 'utf8');

content = content.replace('bg-black border border-[#c5a059]/20', 'bg-white border border-[#c5a059]/20');
content = content.replace('className={	ext-stone-200 transition-all duration-300 md:relative', 'className={	ext-slate-900 transition-all duration-300 md:relative');
content = content.replace('bg-stone-950/60 border-b border-stone-900/60', 'bg-slate-50 border-b border-slate-200');
content = content.replace('tracking-wide text-white italic', 'tracking-wide text-slate-900 italic');
content = content.replace('text-stone-500 text-[10px] sm:text-xs', 'text-slate-500 text-[10px] sm:text-xs');
content = content.replace('border-stone-850 bg-stone-900/60 flex items-center justify-center text-stone-400 hover:text-white', 'border-slate-200 bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900');
content = content.replace('w-full bg-stone-950 h-1 shrink-0', 'w-full bg-slate-100 h-1 shrink-0');
content = content.replace(/scrollbar-thumb-stone-800/g, 'scrollbar-thumb-slate-300');
content = content.replace(/scrollbar-thumb-stone-850/g, 'scrollbar-thumb-slate-300');
content = content.replace(/text-\[11px\] text-stone-400/g, 'text-[11px] text-slate-500');
content = content.replace(/border-\[#1c1917\]\/40/g, 'border-slate-200');
content = content.replace(/'border-\[#c5a059\] bg-\[#c5a059\]\/10 ring-1 ring-\[#c5a059\]\/25 shadow-lg shadow-\[#c5a059\]\/5'/g, "'border-[#c5a059] bg-[#c5a059]/15 ring-1 ring-[#c5a059]/25 shadow-lg shadow-[#c5a059]/20'");
content = content.replace(/'border-stone-900 bg-\[#090807\] hover:border-stone-700 hover:bg-\[#0c0a09\]'/g, "'border-slate-200 bg-slate-50/80 hover:border-slate-300 hover:bg-slate-100 text-slate-900'");
content = content.replace(/text-stone-100/g, 'text-slate-900');
content = content.replace(/text-stone-450/g, 'text-slate-600');
content = content.replace(/border-stone-900\/60/g, 'border-slate-200');
content = content.replace(/text-stone-600/g, 'text-slate-400');
content = content.replace(/text-stone-500 group-hover\/card:text-stone-300/g, 'text-slate-500 group-hover/card:text-slate-700');
content = content.replace(/text-stone-500/g, 'text-slate-500');
content = content.replace(/bg-stone-950\/45/g, 'bg-slate-50');
content = content.replace(/border-stone-900/g, 'border-slate-200');
content = content.replace(/text-stone-300/g, 'text-slate-700');
content = content.replace(/text-stone-400/g, 'text-slate-500');
content = content.replace(/text-stone-200/g, 'text-slate-900');
content = content.replace(/bg-\[#090807\]\/30 border-y border-\[#1c1917\]\/50/g, 'bg-slate-50/80 border-y border-slate-200');
content = content.replace(/hover:bg-stone-900 border-stone-900 hover:border-stone-800/g, 'hover:bg-slate-200 border-slate-200 hover:border-slate-300');
content = content.replace(/'text-stone-800 font-normal line-through opacity-30 cursor-not-allowed'/g, "'text-slate-400 font-normal line-through opacity-50 cursor-not-allowed'");
content = content.replace(/'bg-\[#090807\]\/50 hover:bg-\[#0c0a09\] text-stone-200 border border-stone-900 hover:border-\[#c5a059\]\/30'/g, "'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 hover:border-[#c5a059]/30'");

// Step 3 
content = content.replace(/bg-\[#0d0d0d\] rounded-sm border border-stone-850\/60/g, 'bg-slate-50 rounded-sm border border-slate-200');
content = content.replace(/'border-\[#c5a059\] bg-\[#c5a059\]\/10 text-white shadow-lg shadow-\[#c5a059\]\/15'/g, "'border-[#c5a059] bg-[#c5a059]/15 text-slate-900 shadow-lg shadow-[#c5a059]/20'");
content = content.replace(/'bg-\[#090807\]\/70 border-stone-900 text-stone-300 hover:border-stone-700 hover:bg-\[#0c0a09\]'/g, "'bg-slate-50/80 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-100'");
content = content.replace(/bg-stone-950\/30/g, 'bg-slate-100');

// Step 4
content = content.replace(/bg-\[#090807\] border border-stone-900/g, 'bg-slate-50 border border-slate-200');
content = content.replace(/focus:border-\[#c5a059\]\/80/g, 'focus:border-[#c5a059]');

// Step 5
content = content.replace(/bg-\[#0a0a0a\]\/80 border border-stone-850/g, 'bg-slate-50 border border-slate-200');
content = content.replace(/border-stone-900/g, 'border-slate-200');
content = content.replace(/bg-stone-950\/50/g, 'bg-slate-100');
content = content.replace(/bg-stone-950/g, 'bg-slate-100');

fs.writeFileSync('src/components/BookingWizard.tsx', content);
console.log('done');
