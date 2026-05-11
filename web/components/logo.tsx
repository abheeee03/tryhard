import { cn } from "@/lib/utils"

function Logo({color}: {color?: string}) {
  return (
    <svg className="h-5" id="Layer_2" data-name="Layer 2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 104.56 103.74">
  <defs>
    <style>
      
    </style>
  </defs>
  <g id="Layer_1-2" data-name="Layer 1">
    <g id="element">
      <path className={cn(
        color == "white" ? "fill-white" : color == "black" ? "fill-black" : "fill-foreground"
      ) 
      }
      d="M77.37,0c0,13.86-11.23,25.09-25.09,25.09S27.19,13.86,27.19,0H0c0,28.87,23.41,52.28,52.28,52.28S104.56,28.87,104.56,0h-27.19Z"/>
      <path className={cn(
        color == "white" ? "fill-white" : color == "black" ? "fill-black" : "fill-foreground"
      ) 
      } 
      d="M77.37,103.74c0-13.86-11.23-25.09-25.09-25.09s-25.09,11.23-25.09,25.09H0c0-28.87,23.41-52.28,52.28-52.28s52.28,23.41,52.28,52.28h-27.19Z"/>
    </g>
  </g>
</svg>
  )
}

export default Logo