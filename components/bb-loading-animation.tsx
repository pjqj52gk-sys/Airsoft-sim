export default function BBLoadingAnimation() {
  return <svg className="bb-loading-animation" viewBox="0 0 280 270" aria-hidden="true">
    <ellipse cx="142" cy="252" rx="68" ry="7" fill="#e8f3f9" />
    <g className="bb-plunger"><rect x="115" y="5" width="8" height="34" rx="3" fill="#7b94a8" /><rect x="98" y="2" width="42" height="9" rx="4" fill="#3f627b" /></g>
    <path d="M94 28H144Q153 28 153 38V119L131 135H111L86 119V38Q86 28 94 28Z" fill="#effaff" stroke="#6691ae" strokeWidth="2.5" />
    <path d="M94 28H145" stroke="#3f627b" strokeWidth="7" strokeLinecap="round" />
    <path d="M111 135H131V145H111Z" fill="#67d1f6" stroke="#278bb8" strokeWidth="2" />
    <path d="M96 44V113L112 124" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" />
    <g fill="#9adff8" stroke="#5bb8db" strokeWidth="1">
      {[[107,62],[125,59],[139,69],[101,82],[119,78],[134,86],[105,100],[121,99],[136,105],[116,117]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="6" />)}
    </g>
    <g className="bb-transfer"><circle cx="121" cy="146" r="4" fill="#38bdf8" /><circle cx="121" cy="136" r="4" fill="#8ad8f5" /></g>
    <path d="M109 160H151L156 209Q158 232 141 245L101 235Q117 218 109 160Z" fill="#39586e" />
    <path d="M113 156H148V163H113Z" fill="#54798e" />
    <path d="M120 174H140L144 213Q146 227 136 233L117 229Q126 214 120 174Z" fill="#edf9ff" />
    <path d="M101 233L144 243L142 250L98 240Z" fill="#25455b" />
    <path d="M149 177L153 210M147 220L140 237" fill="none" stroke="#7699ad" strokeWidth="2" strokeLinecap="round" />
    {[[130,225],[135,215],[132,204],[131,193],[129,182]].map(([x,y],i)=><circle key={i} className="bb-magazine-bb" style={{animationDelay:`${i*.16}s`}} cx={x} cy={y} r="4.3" fill="#38bdf8" />)}
    <path d="M181 122L187 128L181 134M181 147L187 153L181 159" fill="none" stroke="#a7d9ef" strokeWidth="2" strokeLinecap="round" transform="rotate(90 184 140)" />
  </svg>;
}
