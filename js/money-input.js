const formatter=new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0});
export function formatVndInput(value){
  return Number.isSafeInteger(value)&&value>=0?formatter.format(value):'';
}
export function parseVndInput(text,{nullable=false}={}){
  const value=String(text).trim().replace(/\s*(?:VND|[đ₫])$/iu,'').replace(/\s/g,'');
  if(!value)return nullable?null:NaN;
  if(!/^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(value))return NaN;
  const amount=Number(value.replace(/\./g,''));
  return Number.isSafeInteger(amount)?amount:NaN;
}
