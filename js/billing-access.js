import {el,button,closeOnBackdrop,dataError} from './ui-elements.js';

// UI gate only. The shared MD5 is read from Firebase, never embedded here.
export function createBillingAccess({root,onUnlock}){
  try{localStorage.removeItem('caulong.billing.credentials');}catch{}
  let verifying=false,generation=0;
  const dialog=el('dialog','day-panel billing-login');dialog.id='billing-login';
  dialog.setAttribute('aria-labelledby','billing-login-title');
  const header=el('div','billing-dialog-header'),title=el('h2',null,'Nhập mật khẩu tính tiền');title.id='billing-login-title';
  const closeButton=button('×',()=>close(),'modal-close');closeButton.setAttribute('aria-label','Đóng đăng nhập');
  header.append(title,closeButton);
  const form=el('form','billing-login-form');form.noValidate=true;
  const passwordLabel=el('label','cost-field','Password'),password=el('input');
  password.type='password';password.name='password';password.autocomplete='off';password.autofocus=true;password.required=true;passwordLabel.append(password);
  const error=el('p','field-error');error.id='billing-login-error';error.setAttribute('role','alert');
  password.setAttribute('aria-describedby',error.id);
  const submit=el('button','button button-primary','Xác nhận');submit.type='submit';form.append(passwordLabel,error,submit);
  password.addEventListener('input',()=>{error.textContent='';password.removeAttribute('aria-invalid');});
  function working(){
    password.disabled=verifying;submit.disabled=verifying;dialog.setAttribute('aria-busy',String(verifying));
    submit.replaceChildren();submit.classList.toggle('is-loading',verifying);
    if(verifying){const spinner=el('span','button-spinner');spinner.setAttribute('aria-hidden','true');submit.append(spinner);}
    submit.append(document.createTextNode(verifying?'Đang xác nhận…':'Xác nhận'));
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(verifying||!dialog.open)return;
    const token=++generation,candidate=password.value;verifying=true;error.textContent='';working();
    try{
      const {verifyAdminPassword}=await import('./admin-password-service.js');
      const valid=await verifyAdminPassword(candidate);
      if(token!==generation||!dialog.open)return;
      if(!valid){error.textContent='Mật khẩu không đúng.';password.setAttribute('aria-invalid','true');}
      else{close();onUnlock();}
    }catch(e){if(token===generation&&dialog.open)error.textContent=!navigator.onLine?'Bạn đang ngoại tuyến. Không thể xác nhận mật khẩu.':dataError(e);}
    finally{if(token===generation){verifying=false;working();if(error.textContent){password.focus();password.select();}}}
  });
  dialog.append(header,el('p','panel-note','Nhập mật khẩu quản trị để mở chi phí buổi cầu.'),form);root.append(dialog);
  closeOnBackdrop(dialog);
  function clear(){++generation;verifying=false;form.reset();error.textContent='';password.removeAttribute('aria-invalid');working();}
  function close(){clear();if(dialog.open)dialog.close();}
  dialog.addEventListener('close',clear);
  return {request(){if(!dialog.open){clear();dialog.showModal();}},close,isOpen:()=>dialog.open};
}
