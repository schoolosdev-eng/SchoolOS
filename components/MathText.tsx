'use client'

import 'katex/dist/katex.min.css'
import { BlockMath, InlineMath } from 'react-katex'

type Props = {
  text: string
}

export default function MathText({
  text,
}: Props) {
  if (!text) return null

  const parts = text.split('$$')

  return (
    <>
      {parts.map((part, index) => {
        const isMath = index % 2 === 1

        if (isMath) {
          return (
            <BlockMath
              key={index}
              math={part}
            />
          )
        }

        return (
          <span key={index}>
            {part}
          </span>
        )
      })}
    </>
  )
}