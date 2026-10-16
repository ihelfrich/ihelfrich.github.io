export function selectionFromSearch(search,courses,fallback){
 const params=new URLSearchParams(search),requested=params.get('course');
 const course=Object.hasOwn(courses,requested)?requested:fallback;
 const raw=params.get('unit'),unit=Number(raw);
 return {course,unit:requested===course&&/^\d+$/.test(raw??'')&&Number.isSafeInteger(unit)&&unit>=1&&unit<=courses[course].units.length?unit:0};
}
export function signInReason({connection,configured,consent,busy}){
 if(connection==='connecting')return 'Checking whether Google sign-in is available…';
 if(connection!=='connected')return 'Sign-in is unavailable while the response service is disconnected. Reload after the connection is restored.';
 if(!configured)return 'Google sign-in is not configured in this environment. Anonymous practice is available; instructor access requires a configured sign-in service.';
 if(busy)return 'Please wait for the current request to finish before signing in.';
 if(!consent)return 'To sign in, first acknowledge answer storage under “Your answer history” below.';
 return '';
}
