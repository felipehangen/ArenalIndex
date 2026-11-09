/* One display policy for the entire app: whole numbers, including USD/m². */
(() => {
  const formatter = new Intl.NumberFormat('en-US', {maximumFractionDigits: 0});
  const number = value => formatter.format(value);
  const money = (value,currency='USD') => (currency==='CRC'?'₡':'$') + number(value);
  const compactMoney = (value,currency='USD') => value >= 1000000 ? (currency==='CRC'?'₡':'$')+new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(value/1000000)+'M' : value >= 1000 ? (currency==='CRC'?'₡':'$') + number(value / 1000) + 'K' : money(value,currency);
  window.ArenalFormat = Object.freeze({number, money, compactMoney});
})();
