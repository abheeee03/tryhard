import React from 'react'
import localFont from 'next/font/local';
import Image from 'next/image';

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
          <div className=" px-10 py-10 rounded-xl">
            <Image src="/icon.svg" alt="Icon" width={100} height={100} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomePage