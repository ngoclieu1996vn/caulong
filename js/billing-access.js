import {el,button,closeOnBackdrop} from './ui-elements.js';

// Client-side convenience gate only. These credentials are public source code;
// authorization for Firestore remains entirely determined by Firestore Rules.
export function createBillingAccess({root,onUnlock}){
  const storageKey='caulong.billing.credentials';
  const dialog=el('dialog','day-panel billing-login');dialog.id='billing-login';
  dialog.setAttribute('aria-labelledby','billing-login-title');
  const header=el('div','billing-dialog-header'),title=el('h2',null,'Đăng nhập tính tiền');title.id='billing-login-title';
  const closeButton=button('×',()=>close(),'modal-close');closeButton.setAttribute('aria-label','Đóng đăng nhập');
  header.append(title,closeButton);
  const form=el('form','billing-login-form');form.noValidate=true;
  const usernameLabel=el('label','cost-field','Username'),username=el('input');
  username.type='text';username.name='username';username.autocomplete='username';username.autofocus=true;
  username.autocapitalize='none';username.spellcheck=false;username.required=true;usernameLabel.append(username);
  const passwordLabel=el('label','cost-field','Password'),password=el('input');
  password.type='password';password.name='password';password.autocomplete='current-password';password.required=true;passwordLabel.append(password);
  const error=el('p','field-error');error.id='billing-login-error';error.setAttribute('role','alert');
  username.setAttribute('aria-describedby',error.id);password.setAttribute('aria-describedby',error.id);
  const submit=el('button','button button-primary','Đăng nhập');submit.type='submit';
  form.append(usernameLabel,passwordLabel,error,submit);
  form.addEventListener('submit',event=>{
    event.preventDefault();
    if(username.value.trim()!=='admin'||password.value!=='lieuvippro'){
      error.textContent='Username hoặc Password không đúng.';password.setAttribute('aria-invalid','true');password.focus();password.select();return;
    }
    try{localStorage.setItem(storageKey,JSON.stringify({username:username.value.trim(),password:password.value}));}catch{}
    close();onUnlock();
  });
  dialog.append(header,el('p','panel-note','Nhập tài khoản để mở phần chi phí buổi cầu.'),form);root.append(dialog);
  closeOnBackdrop(dialog);
  function clear(){form.reset();error.textContent='';password.removeAttribute('aria-invalid');}
  function close(){clear();if(dialog.open)dialog.close();}
  dialog.addEventListener('close',clear);
  return {request(){if(!dialog.open){
    clear();
    try{
      const stored=JSON.parse(localStorage.getItem(storageKey));
      if(typeof stored?.username==='string'&&typeof stored?.password==='string'){
        username.value=stored.username;password.value=stored.password;
      }
    }catch{}
    dialog.showModal();
  }},close,isOpen:()=>dialog.open};
}
