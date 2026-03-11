"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import ReactLenis from "lenis/react";
import React, { useRef } from "react";

const projects = [
    {
        title: "Enter a Topic and Get the Questions",
        desc: "You can and your friend can choose a topic. whatever it can be ai, blockchain, politics, etc. hit create room and enter a name of that topic clearly, now ai generates the questions automatically based on the name",
    },
    {
        title: "Stake Solana",
        desc: "You deposit solana which creates the room, this solana is deposited to the escrow contract. share the invite code to your friend or keep it open so other players can join.",
    },
    {
        title: "Start the Match",
        desc: "When both player joins completes the depsit, owner of the match can start the game. once game is started questions will start coming at same time to both the players.",
    },
    {
        title: "Answer!",
        desc: "questions keep shooting at you keep answering them asap!",
    },
    {
        title: "win / lose",
        desc: "the one who answers the most correct question wins and escrow is released to respective winner.",
    },
];

const StickyCard = ({
    i,
    title,
    desc,
    progress,
    range,
    targetScale,
}: {
    i: number;
    title: string;
    desc: string;
    progress: any;
    range: [number, number];
    targetScale: number;
}) => {
    const container = useRef<HTMLDivElement>(null);

    const scale = useTransform(progress, range, [1, targetScale]);

    return (
        <div
            ref={container}
            className="sticky top-0 flex items-center justify-center"
        >
            <motion.div
                style={{
                    scale,
                    top: `calc(-5vh + ${i * 20 + 250}px)`,
                }}
                className="rounded-4xl px-6 md:px-10 py-6 bg-blue-500 relative -top-1/4 flex min-h-[220px] h-auto w-[90vw] max-w-[700px] origin-top flex-col overflow-hidden"
            >
                <h1 className="text-3xl font-semibold">{title}</h1>
                <p className="text-xl mt-5">{desc}</p>
            </motion.div>
        </div>
    );
};

const FeatureSection = () => {
    const container = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: container,
        offset: ["start start", "end end"],
    });

    return (
        <div ref={container} className="bg-[#9395F5] px-2">
            <ReactLenis root>
                <main
                    className="relative flex w-full bg-white rounded-xl flex-col items-center justify-start pb-[90vh] pt-[20vh]"
                >
                    <div className="text-5xl font-semibold text-black">How to use?</div>
                    {projects.map((project, i) => {
                        const targetScale = Math.max(
                            0.5,
                            1 - (projects.length - i - 1) * 0.1,
                        );
                        return (
                            <StickyCard
                                key={`p_${i}`}
                                i={i}
                                {...project}
                                progress={scrollYProgress}
                                range={[i * 0.25, 1]}
                                targetScale={targetScale}
                            />
                        );
                    })}
                </main>
                <div className="flex flex-col items-center justify-center w-full">
                    <h1 className='text-[30vw] md:text-[20vw] font-semibold'>TryHard</h1>
                    <span className="text-2xl pb-10">built by <a target="_blank" href="https://abhee.dev" className="pr-1 underline">
                        abhee
                    </a>
                        at <a href="https://solanamobile.radiant.nexus/">
                            monolith hackathon
                        </a>
                    </span>
                </div>
            </ReactLenis>
        </div>
    );
};

export { FeatureSection };

/**
 * Author: @gurvinder-singh02
 * Website: https://gxuri.in
 * Twitter: https://x.com/Gur__vi
 */
