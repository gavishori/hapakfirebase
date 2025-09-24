// Currency toggle: includes EUR
const ILS_PER_UNIT = { ILS:1, USD:3.70, EUR:4.00 };
const CYCLE = ['ILS', 'USD', 'EUR'];
const STORAGE_KEY = 'selectedCurrency';

const toggleBtn = document.getElementById('currencyToggle');
let currency = localStorage.getItem(STORAGE_KEY) || 'ILS';

function ilsToCurrency(ils, target){ return ils / (ILS_PER_UNIT[target] || 1); }
function fmt(n){ return Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }

function recalc(){
  const budgetEl = document.querySelector('.money[data-key="budget"]');
  const paidEl = document.querySelector('.money[data-key="paid"]');
  const balanceEl = document.querySelector('.money[data-key="balance"]');

  const budgetILS = parseFloat(budgetEl?.dataset.baseIls || '0');
  const paidILS = parseFloat(paidEl?.dataset.baseIls || '0');
  const balanceILS = budgetILS - paidILS;
  if(balanceEl) balanceEl.dataset.baseIls = String(balanceILS);

  document.querySelectorAll('.money').forEach(el=>{
    const base = parseFloat(el.dataset.baseIls || '0');
    const val = ilsToCurrency(base, currency);
    el.textContent = fmt(val);
    if (el.dataset.key === 'balance') el.classList.toggle('negative', base < 0);
  });
}

function setCurrency(next){
  currency = next;
  localStorage.setItem(STORAGE_KEY, currency);
  toggleBtn.textContent = currency;
  recalc();
}

toggleBtn.addEventListener('click', ()=>{
  const i = CYCLE.indexOf(currency);
  setCurrency(CYCLE[(i+1)%CYCLE.length]);
});

document.addEventListener('DOMContentLoaded', ()=> setCurrency(currency));
