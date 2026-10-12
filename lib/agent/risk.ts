export function containsUnsafeAdvice(responseText: string) {
  const clauses = responseText.split(/[\n，。；！？,.;!?]/).map((item) => item.trim()).filter(Boolean);
  return clauses.some((clause) => {
    const dangerousAction = /(?:转账|打款|汇款|付保证金)|(?:提供|发送|告诉).{0,6}(?:验证码|密码|银行卡|付款码|收款码)/.test(clause);
    const directive = /请|需要|应当|必须|立即|马上|可以/.test(clause);
    const negated = /不要|不需要|不应|不能|不可以|不可|无需|切勿|请勿|禁止|拒绝|避免|勿/.test(clause);
    return dangerousAction && directive && !negated;
  });
}
