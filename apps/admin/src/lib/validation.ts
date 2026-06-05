/** 비밀번호 유효성 검사 규칙을 공통으로 관리합니다. */

export const PASSWORD_MIN_LENGTH = 8

/** 비밀번호 유효성 검사. 문제가 있으면 에러 메시지, 없으면 null을 반환합니다. */
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`
  }
  return null
}

/** 두 비밀번호 일치 여부 검사. 문제가 있으면 에러 메시지, 없으면 null을 반환합니다. */
export function validatePasswordConfirm(password: string, confirm: string): string | null {
  if (password !== confirm) {
    return '비밀번호가 일치하지 않습니다.'
  }
  return null
}

/** 이메일 형식 검사. 문제가 있으면 에러 메시지, 없으면 null을 반환합니다. */
export function validateEmail(email: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return '올바른 이메일 형식이 아닙니다.'
  }
  return null
}
