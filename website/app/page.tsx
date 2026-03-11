"use client"
import localFont from 'next/font/local';
import { FeatureSection } from '@/components/features';
import { cn } from "@/lib/utils";
import Link from 'next/link';

const grotesk = localFont({
  src: '../font/CabinetGrotesk.ttf',
})

function HomePage() {
  return (
    <div className={`min-h-screen w-full ${grotesk.className}`}>
      {/* Fixed Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 md:px-20 py-4 md:py-8 text-black font-semibold">
        <div className="border flex items-center justify-between border-black/10 rounded-full w-full px-6 py-3 backdrop-blur-sm">
          <h1 className='text-2xl'>TryHard</h1>
          <div className="">
            <a
              target='_blank'
              href="https://github.com/abheeee03/tryhard/releases/download/v1/TryHard.apk"
              className={cn(
                "group relative flex items-center",
                "before:pointer-events-none before:absolute before:left-0 before:top-[1.5em] before:h-[0.05em] before:w-full before:bg-current before:content-['']",
                "before:origin-right before:scale-x-0 before:transition-transform before:duration-300 before:ease-[cubic-bezier(0.4,0,0.2,1)]",
                "before:origin-center",
                "hover:before:scale-x-100",
              )}
            >
              Download
              <svg
                className="ml-[0.3em] mt-[0em] size-[0.55em] translate-y-1 opacity-0 transition-all duration-300 [motion-reduce:transition-none] group-hover:translate-y-0 group-hover:opacity-100 motion-reduce:transition-none"
                fill="none"
                viewBox="0 0 10 10"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M1.004 9.166 9.337.833m0 0v8.333m0-8.333H1.004"
                  stroke="currentColor"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                ></path>
              </svg>
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen w-full flex flex-col items-center justify-center pt-20 text-black">
        <div
          className="absolute inset-0 z-0"
          style={{
            background: "radial-gradient(125% 125% at 50% 10%, #fff 40%, #6366f1 100%)",
          }}
        />
        <div className="relative z-10 flex flex-col items-center gap-8 px-4 max-w-5xl mx-auto text-center">
          <span className='px-5 py-1 rounded-full border border-black/10'>introducing tryhard</span>
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-semibold text-black tracking-tight leading-[1.1]">
              Challenge Your Friends <br />
              <span className="">
                And Win Real
              </span>
            </h1>
            <p className="text-xl md:text-xl text-gray-700 max-w-2xl mx-auto font-medium mt-6">
              Bet with your friends, AI generates the Quiz and the real G wins
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-10 mt-8">
            <Link target='_blank' href={"https://github.com/abheeee03/tryhard/releases/download/v1/TryHard.apk"} className="text-xl bg-blue-500 font-medium shadow-xl border-b-2 border-black/50 text-white px-10 py-4 rounded-2xl">
              Download Now
            </Link>
          </div>
        </div>
      </section>
      <FeatureSection />
    </div>
  )
}

export default HomePage