/* One display policy for the entire app: whole numbers, including USD/m². */
(() => {
  const formatter = new Intl.NumberFormat('en-US', {maximumFractionDigits: 0});
  const number = value => formatter.format(value);
  const money = value => '$' + number(value);
  const compactMoney = value => value >= 1000 ? '$' + number(value / 1000) + 'K' : money(value);
  window.ArenalFormat = Object.freeze({number, money, compactMoney});
})();
