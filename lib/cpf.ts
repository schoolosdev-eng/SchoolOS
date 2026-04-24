export function normalizeCpf(value: string) {
  return value.replace(/\D/g, '').slice(0, 11)
}

export function formatCpf(value: string) {
  const cpf = normalizeCpf(value)

  if (cpf.length <= 3) return cpf
  if (cpf.length <= 6) return `${cpf.slice(0, 3)}.${cpf.slice(3)}`
  if (cpf.length <= 9) return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6)}`
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9, 11)}`
}

export function isValidCpf(value: string) {
  const cpf = normalizeCpf(value)

  if (cpf.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cpf)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += Number(cpf[i]) * (10 - i)
  }

  let firstDigit = (sum * 10) % 11
  if (firstDigit === 10) firstDigit = 0

  if (firstDigit !== Number(cpf[9])) return false

  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += Number(cpf[i]) * (11 - i)
  }

  let secondDigit = (sum * 10) % 11
  if (secondDigit === 10) secondDigit = 0

  return secondDigit === Number(cpf[10])
}

export function getCpfValidationMessage(value: string) {
  const cpf = normalizeCpf(value)

  if (!cpf) return 'Informe o CPF.'
  if (cpf.length !== 11) return 'O CPF deve ter 11 números.'
  if (!isValidCpf(cpf)) return 'Informe um CPF válido.'

  return null
}