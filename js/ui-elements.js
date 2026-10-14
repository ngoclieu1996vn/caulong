export function el(tag,className,text) {
  const node=document.createElement(tag);
  if(className) node.className=className;
  if(text!==undefined) node.textContent=text;
  return node;
}
export function button(text,action,className='button button-light') {
  const node=el('button',className,text);node.type='button';node.addEventListener('click',action);return node;
}
export function numberField(label,value,onChange,{nullable=false,max}={}) {
  const wrap=el('label','cost-field',label), input=el('input');
  input.type='number';input.min='0';input.step='1';input.inputMode='numeric';input.value=value??'';
  if(max!==undefined) input.max=String(max);
  input.addEventListener('input',()=>onChange(input.value==='' ? (nullable?null:NaN) : Number(input.value)));
  wrap.append(input);return wrap;
}
export function dataError(error) {
  if(error?.code==='revision-conflict') return 'Dữ liệu đã được sửa từ thiết bị khác. Hãy tải bản mới trước khi lưu.';
  if(error?.code==='permission-denied') return 'Firebase chưa cho phép lưu phần này. Vui lòng Publish file Firestore Rules mới rồi kết nối lại.';
  if(!navigator.onLine || ['unavailable','deadline-exceeded'].includes(error?.code)) return 'Chưa kết nối được Firebase. Dữ liệu chưa lưu; hãy kết nối mạng rồi thử lại.';
  return error?.message || 'Không thể lưu. Vui lòng thử lại.';
}
