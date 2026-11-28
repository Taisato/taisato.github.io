const UI=Object.freeze({ink:'#080d1d',panel:'#10192e',raised:'#18233d',line:'#34435d',muted:'#99aac4',white:'#f1f6ff',mint:'#9cfbd7',lilac:'#b6a1ff',red:'#ff8eaa'});
function shape(c,x,y,w,h,cut=14){c.beginPath();c.moveTo(x+cut,y);c.lineTo(x+w,y);c.lineTo(x+w,y+h-cut);c.lineTo(x+w-cut,y+h);c.lineTo(x,y+h);c.lineTo(x,y+cut);c.closePath();}
function panel(c,w,h){
 c.clearRect(0,0,w,h);shape(c,2,2,w-4,h-4,24);c.fillStyle=UI.ink;c.fill();c.strokeStyle=UI.line;c.lineWidth=2;c.stroke();
 c.save();c.clip();const g=c.createRadialGradient(w*.88,0,0,w*.88,0,w*.8);g.addColorStop(0,'#283052');g.addColorStop(1,UI.ink);c.fillStyle=g;c.fillRect(0,0,w,h);
 c.fillStyle='#7489a7';for(const [x,y]of[[.83,.12],[.94,.44],[.71,.08],[.91,.73]])c.fillRect(w*x,h*y,2,2);c.restore();
 c.fillStyle=UI.mint;c.fillRect(32,1,72,4);c.fillStyle=UI.lilac;c.fillRect(108,1,28,4);
}
function label(c,value,x,y,size=24,color=UI.white,align='left',weight=600){c.fillStyle=color;c.font=weight+' '+size+'px Arial, "Liberation Sans", sans-serif';c.textAlign=align;c.textBaseline='middle';c.fillText(value,x,y);}
function tracked(c,value,x,y,size=18,color=UI.muted,spacing=3){c.fillStyle=color;c.font='600 '+size+'px Arial, "Liberation Sans", sans-serif';c.textAlign='left';c.textBaseline='middle';for(const char of value){c.fillText(char,x,y);x+=c.measureText(char).width+spacing;}}
function brand(c,x,y,scale=1){c.save();c.translate(x,y);c.transform(1,0,-.10,1,0,0);label(c,'FIRST TOUCH',0,0,34*scale,UI.white,'left',900);c.restore();}
function heart(c,x,y,size,active=true){
 c.save();c.translate(x,y);c.scale(size/24,size/24);c.beginPath();c.moveTo(0,9);c.bezierCurveTo(-3,5,-12,-1,-12,-7);c.bezierCurveTo(-12,-14,-3,-15,0,-9);c.bezierCurveTo(3,-15,12,-14,12,-7);c.bezierCurveTo(12,-1,3,5,0,9);c.closePath();c.fillStyle=active?UI.lilac:'#1b2740';c.fill();c.strokeStyle=active?UI.lilac:'#59667f';c.lineWidth=1.5;c.stroke();c.restore();
}
function touch(c,x,y,size,active=true){
 c.beginPath();c.arc(x,y,size*.5,0,Math.PI*2);c.fillStyle=active?UI.mint:'#17273a';c.fill();c.strokeStyle=active?UI.mint:'#52647a';c.lineWidth=2;c.stroke();
 if(active){c.beginPath();for(let i=0;i<5;i++){const a=-Math.PI/2+i*Math.PI*2/5,px=x+Math.cos(a)*size*.17,py=y+Math.sin(a)*size*.17;i?c.lineTo(px,py):c.moveTo(px,py);}c.closePath();c.fillStyle='#17372f';c.fill();}
}
function pitch(c,x,y,w,h,color=UI.mint){c.save();c.strokeStyle=color;c.lineWidth=2.5;c.strokeRect(x,y,w,h);c.beginPath();c.moveTo(x+w*.5,y);c.lineTo(x+w*.5,y+h);c.stroke();c.beginPath();c.arc(x+w*.5,y+h*.5,h*.18,0,Math.PI*2);c.stroke();c.strokeRect(x,y+h*.28,w*.15,h*.44);c.strokeRect(x+w*.85,y+h*.28,w*.15,h*.44);c.restore();}
function button(c,b,{hover=false,selected=false,primary=false}={}){shape(c,b.x,b.y,b.w,b.h,12);c.fillStyle=primary?(hover?'#c6ffe9':UI.mint):(hover?'#263653':selected?'#183c3a':UI.panel);c.fill();c.strokeStyle=primary?UI.mint:selected?UI.mint:hover?'#8298bc':UI.line;c.lineWidth=selected?2.5:1.5;c.stroke();label(c,b.label,b.x+b.w/2,b.y+b.h/2,primary?33:26,primary?UI.ink:UI.white,'center',primary?800:600);}
export {UI,shape,panel,label,tracked,brand,heart,touch,pitch,button};
