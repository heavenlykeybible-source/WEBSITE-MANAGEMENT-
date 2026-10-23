export const PASSWORD_MIN=15;
export const PASSWORD_MAX=128;
export function passwordError(value){
 if(typeof value!=='string')return 'Use 15 to 128 characters.';
 const length=Array.from(value).length;
 if(length<PASSWORD_MIN||length>PASSWORD_MAX)return 'Use 15 to 128 characters.';
 return '';
}
