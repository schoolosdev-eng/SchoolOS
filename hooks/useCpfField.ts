'use client'

import { useMemo, useState } from 'react'
import { formatCpf, getCpfValidationMessage, normalizeCpf } from '@/lib/cpf'

export function useCpfField(initialValue = '') {
  const [cpf, setCpf] = useState(normalizeCpf(initialValue))

  const formattedCpf = useMemo(() => formatCpf(cpf), [cpf])

  function handleCpfChange(value: string) {
    setCpf(normalizeCpf(value))
  }

  function validateCpf() {
    return getCpfValidationMessage(cpf)
  }

  return {
    cpf,
    setCpf,
    formattedCpf,
    handleCpfChange,
    validateCpf,
    normalizedCpf: normalizeCpf(cpf),
  }
}