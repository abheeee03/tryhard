import React from 'react'
import localFont from 'next/font/local';

const grotesk = localFont({
  src: '../font/CabinetGrotesk.ttf',
})
function HomePage() {
  return (
    <div className={`min-h-screen w-full ${grotesk.className}`}>
      <div className="h-screen w-full flex items-center flex-col gap-10 justify-center">
        <div className="text-center font-semibold">
          <h1 className='text-7xl'>Challenge Your Friends</h1>
          <h1 className='text-7xl'>And Win Real</h1>
        </div>
        <div className="flex gap-10">
          <button className='text-xl font-semibold bg-blue-500 px-5 py-2 rounded-xl'>Download Now</button>
          <button className='text-xl'>Learn More</button>
          <div className="bg-white">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" width="100%" height="100%">
              <g id="shadow">
                <ellipse cx="200" cy="460" rx="90" ry="12" fill="#d1d5db" />
              </g>

              <g id="legs">
                <g id="left-leg">
                  <path d="M 160,330 Q 140,370 140,410" fill="none" stroke="#000" stroke-width="16" stroke-linecap="round" />
                  <g id="left-shoe">
                    <path d="M 110,430 C 110,410 130,400 150,400 C 170,400 170,430 170,440 C 170,450 120,450 110,430 Z" fill="#4B5563" stroke="#000" stroke-width="3" stroke-linejoin="round" />
                    <path d="M 108,440 C 120,460 165,460 172,440 C 170,448 120,448 108,440 Z" fill="#FDBA74" stroke="#000" stroke-width="3" stroke-linejoin="round" />
                    <path d="M 125,400 C 125,390 155,390 155,400 C 155,410 125,410 125,400 Z" fill="#4B5563" stroke="#000" stroke-width="3" stroke-linejoin="round" />
                  </g>
                </g>

                <g id="right-leg">
                  <path d="M 240,330 Q 260,370 260,410" fill="none" stroke="#000" stroke-width="16" stroke-linecap="round" />
                  <g id="right-shoe">
                    <path d="M 290,430 C 290,410 270,400 250,400 C 230,400 230,430 230,440 C 230,450 280,450 290,430 Z" fill="#4B5563" stroke="#000" stroke-width="3" stroke-linejoin="round" />
                    <path d="M 292,440 C 280,460 235,460 228,440 C 230,448 280,448 292,440 Z" fill="#FDBA74" stroke="#000" stroke-width="3" stroke-linejoin="round" />
                    <path d="M 275,400 C 275,390 245,390 245,400 C 245,410 275,410 275,400 Z" fill="#4B5563" stroke="#000" stroke-width="3" stroke-linejoin="round" />
                  </g>
                </g>
              </g>

              <g id="arms">
                <path id="left-arm" d="M 90,250 Q 60,270 65,310" fill="none" stroke="#000" stroke-width="14" stroke-linecap="round" />
                <path id="right-arm" d="M 310,250 Q 340,270 335,310" fill="none" stroke="#000" stroke-width="14" stroke-linecap="round" />
              </g>

              <g id="brain-body">
                <path d="M 200,60 C 170,50 140,70 130,100 C 100,110 90,140 90,170 C 70,190 70,230 80,260 C 80,290 110,320 140,330 C 160,340 190,330 200,310 C 210,330 240,340 260,330 C 290,320 320,290 320,260 C 330,230 330,190 310,170 C 310,140 300,110 270,100 C 260,70 230,50 200,60 Z" fill="#FCA5A5" stroke="#000" stroke-width="4" stroke-linejoin="round" />

                <path d="M 200,60 Q 195,105 200,140" fill="none" stroke="#000" stroke-width="4" stroke-linecap="round" />
                <path d="M 200,310 Q 195,280 200,265" fill="none" stroke="#000" stroke-width="4" stroke-linecap="round" />

                <g id="brain-texture" fill="none" stroke="#E07A85" stroke-width="3" stroke-linecap="round">
                  <path d="M 130,100 Q 160,90 170,120 Q 140,130 110,120" />
                  <path d="M 270,100 Q 240,90 230,120 Q 260,130 290,120" />
                  <path d="M 100,160 Q 130,140 140,170 Q 110,190 90,175" />
                  <path d="M 300,160 Q 270,140 260,170 Q 290,190 310,175" />
                  <path d="M 90,220 Q 120,200 130,230 Q 100,250 85,240" />
                  <path d="M 310,220 Q 280,200 270,230 Q 300,250 315,240" />
                  <path d="M 120,290 Q 150,270 170,300 Q 140,320 130,300" />
                  <path d="M 280,290 Q 250,270 230,300 Q 260,320 270,300" />
                </g>
              </g>

              <g id="hands">
                <g id="left-hand">
                  <path d="M 50,305 C 45,295 85,295 80,305 Z" fill="#fff" stroke="#000" stroke-width="3" stroke-linejoin="round" />
                  <path d="M 45,310 C 25,310 25,350 45,350 C 65,350 85,340 85,320 C 85,300 65,310 45,310 Z" fill="#fff" stroke="#000" stroke-width="3" stroke-linejoin="round" />
                  <path d="M 35,350 Q 40,360 50,348" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round" />
                  <path d="M 50,348 Q 60,360 65,342" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round" />
                </g>

                <g id="right-hand">
                  <path d="M 350,305 C 355,295 315,295 320,305 Z" fill="#fff" stroke="#000" stroke-width="3" stroke-linejoin="round" />
                  <path d="M 355,310 C 375,310 375,350 355,350 C 335,350 315,340 315,320 C 315,300 335,310 355,310 Z" fill="#fff" stroke="#000" stroke-width="3" stroke-linejoin="round" />
                  <path d="M 365,350 Q 360,360 350,348" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round" />
                  <path d="M 350,348 Q 340,360 335,342" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round" />
                </g>
              </g>

              <g id="face">
                <g id="eyes">
                  <g id="left-eye">
                    <ellipse id="left-eye-white" cx="165" cy="170" rx="18" ry="22" fill="#fff" stroke="#000" stroke-width="3" />
                    <circle id="left-pupil" cx="165" cy="175" r="5" fill="#000" />
                    <path id="left-brow" d="M 135,145 Q 165,140 195,160 L 195,145 Q 165,120 135,135 Z" fill="#000" stroke="#000" stroke-width="2" stroke-linejoin="round" />
                  </g>

                  <g id="right-eye">
                    <ellipse id="right-eye-white" cx="235" cy="170" rx="18" ry="22" fill="#fff" stroke="#000" stroke-width="3" />
                    <circle id="right-pupil" cx="235" cy="175" r="5" fill="#000" />
                    <path id="right-brow" d="M 265,145 Q 235,140 205,160 L 205,145 Q 235,120 265,135 Z" fill="#000" stroke="#000" stroke-width="2" stroke-linejoin="round" />
                  </g>
                </g>

                <g id="mouth">
                  <path id="mouth-base" d="M 170,210 Q 200,195 230,210 C 240,260 160,260 170,210 Z" fill="#000" stroke="#000" stroke-width="3" stroke-linejoin="round" />
                  <path id="teeth" d="M 172,212 Q 200,200 228,212 C 225,225 175,225 172,212 Z" fill="#fff" />
                  <path id="tongue" d="M 185,248 C 185,235 215,235 215,248 C 215,255 185,255 185,248 Z" fill="#E11D48" />
                </g>
              </g>

            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomePage