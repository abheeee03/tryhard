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
        </div>
      </div>
    </div>
  )
}

export default HomePage