import React from 'react'
import { Card, CardContent, CardFooter } from './card'
import { Button } from './button'

function MatchCard({title, stake, status}: {title: string, stake: number,status: string}) {
  return (
    <Card>
        <CardContent>
            <h1 className='text-xl font-bold'>
                 {title}
            </h1>
            <div className="flex items-center justify-between h-full">
                <div className="">
                    <p>stake</p>
                    <h2 className='text-xl font-bold'>{stake} SOL</h2>
                </div>
                <div className="">
                    <p>status</p>
                    <h2 className='text-xl'>{status}</h2>
                </div>
            </div>
        </CardContent>
            <CardFooter className='flex items-center justify-end gap-3'>
                <Button variant={"outline"}>
                    Know More
                </Button>
                <Button>
                    Join Match
                </Button>
            </CardFooter>
    </Card>
  )
}

export default MatchCard