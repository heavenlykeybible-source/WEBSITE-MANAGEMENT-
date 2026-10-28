export const PASSWORD_MIN=6;
export const PASSWORD_MAX=128;
export function passwordError(value){
 if(typeof value!=='string')return 'Use 6 to 128 characters.';
 const length=Array.from(value).length;
 if(length<PASSWORD_MIN||length>PASSWORD_MAX)return 'Use 6 to 128 characters.';
 return '';
}
