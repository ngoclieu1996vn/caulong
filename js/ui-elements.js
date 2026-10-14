import {parseVndInput,formatVndInput} from './money-input.js';

export function el(tag,className,text) {
  const node=document.createElement(tag);
  if(className) node.className=className;
  if(text!==undefined) node.textContent=text;
  return node;
}
export function button(text,action,className='button button-light') {
  const node=el('button',className,text);node.type='button';node.addEventListener('click',action);return node;
}
export function closeOnBackdrop(dialog,canClose=()=>true){
  let startedOutside=false;
  const outside=event=>{
    const rect=dialog.getBoundingClientRect();
    return event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom;
  };
  dialog.addEventListener('pointerdown',event=>{startedOutside=event.target===dialog&&outside(event);});
  dialog.addEventListener('pointercancel',()=>{startedOutside=false;});
  dialog.addEventListener('click',event=>{
    const dismiss=startedOutside&&event.target===dialog&&outside(event);startedOutside=false;
    if(dismiss&&canClose())dialog.close();
  });
}
export function numberField(label,value,onChange,{nullable=false,max}={}) {
  const wrap=el('label','cost-field',label), input=el('input');
  input.type='number';input.min='0';input.step='1';input.inputMode='numeric';input.value=value??'';
  if(max!==undefined) input.max=String(max);
  input.addEventListener('input',()=>onChange(input.value==='' ? (nullable?null:NaN) : Number(input.value)));
  wrap.append(input);return wrap;
}
export function moneyField(label,value,onChange,{nullable=false}={}){
  const wrap=el('label','cost-field',label),frame=el('span','money-input-frame'),input=el('input'),unit=el('span','money-unit','đ');
  input.type='text';input.inputMode='numeric';input.value=formatVndInput(value);input.autocomplete='off';input.spellcheck=false;
  unit.setAttribute('aria-hidden','true');
  input.addEventListener('input',event=>{
    const raw=input.value,caret=input.selectionStart??raw.length;
    const digitsBefore=(raw.slice(0,caret).match(/\d/g)||[]).length;
    // Regroup existing separators after digit insertion/deletion. Pasted text
    // and manually entered separators must follow the displayed VND format.
    const regroup=!input.hasAttribute('aria-invalid') && (event.inputType?.startsWith('delete') ||
      (event.inputType==='insertText'&&/^\d+$/.test(event.data??'')));
    const amount=parseVndInput(regroup?raw.replace(/\./g,''):raw,{nullable});
    if(Number.isSafeInteger(amount)){
      input.value=formatVndInput(amount);
      let position=0,count=0;
      while(position<input.value.length&&count<digitsBefore){if(/\d/.test(input.value[position]))count++;position++;}
      input.setSelectionRange(position,position);
    }
    if(Number.isNaN(amount))input.setAttribute('aria-invalid','true');else input.removeAttribute('aria-invalid');
    onChange(amount);
  });
  frame.append(input,unit);wrap.append(frame);return wrap;
}
export function dataError(error) {
  if(error?.code==='revision-conflict') return 'Dữ liệu đã được sửa từ thiết bị khác. Hãy tải bản mới trước khi lưu.';
  if(error?.code==='permission-denied') return 'Firebase chưa cho phép lưu phần này. Vui lòng Publish file Firestore Rules mới rồi kết nối lại.';
  if(!navigator.onLine || ['unavailable','deadline-exceeded'].includes(error?.code)) return 'Chưa kết nối được Firebase. Dữ liệu chưa lưu; hãy kết nối mạng rồi thử lại.';
  return error?.message || 'Không thể lưu. Vui lòng thử lại.';
}
