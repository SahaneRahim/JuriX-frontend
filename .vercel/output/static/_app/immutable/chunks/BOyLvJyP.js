import{O as l,P as b}from"./DZx69_d8.js";function C(t){return t*t*t}function $(t){const n=t-1;return n*n*n+1}function S(t,{delay:n=0,duration:s=400,easing:c=b}={}){const a=+getComputedStyle(t).opacity;return{delay:n,duration:s,easing:c,css:r=>`opacity: ${r*a}`}}function O(t,{delay:n=0,duration:s=400,easing:c=$,x:a=0,y:r=0,opacity:e=0}={}){const o=getComputedStyle(t),i=+o.opacity,u=o.transform==="none"?"":o.transform,y=i*(1-e),[p,f]=l(a),[d,g]=l(r);return{delay:n,duration:s,easing:c,css:(m,_)=>`
			transform: ${u} translate(${(1-m)*p}${f}, ${(1-m)*d}${g});
			opacity: ${i-y*_}`}}function U(t,{delay:n=0,duration:s=400,easing:c=$,start:a=0,opacity:r=0}={}){const e=getComputedStyle(t),o=+e.opacity,i=e.transform==="none"?"":e.transform,u=1-a,y=o*(1-r);return{delay:n,duration:s,easing:c,css:(p,f)=>`
			transform: ${i} scale(${1-u*f});
			opacity: ${o-y*f}
		`}}export{O as a,$ as b,C as c,S as f,U as s};
