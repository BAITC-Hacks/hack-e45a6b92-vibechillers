(() => {
  'use strict';

  const STORAGE_KEY = 'spendwise-expenses-v1';
  const currencyFormatter = new Intl.NumberFormat('kk-KZ', {
    style: 'currency',
    currency: 'KZT',
    maximumFractionDigits: 2,
  });

  const form = document.querySelector('#expense-form');
  const amountInput = document.querySelector('#amount');
  const categoryInput = document.querySelector('#category');
  const dateInput = document.querySelector('#date');
  const descriptionInput = document.querySelector('#description');
  const monthInput = document.querySelector('#month');
  const errorBox = document.querySelector('#form-error');
  const monthlyTotal = document.querySelector('#monthly-total');
  const expenseCount = document.querySelector('#expense-count');
  const expenseList = document.querySelector('#expense-list');
  const categoryTotals = document.querySelector('#category-totals');

  let expenses = loadExpenses();

  function todayIso() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
  }

  function currentMonth() {
    return todayIso().slice(0, 7);
  }

  function loadExpenses() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isStoredExpense);
    } catch (_) {
      return [];
    }
  }

  function isStoredExpense(item) {
    return item && typeof item.id === 'string' && Number.isFinite(item.amount) && item.amount > 0 &&
      typeof item.category === 'string' && item.category.trim() &&
      typeof item.date === 'string' && isValidDate(item.date) &&
      typeof item.description === 'string';
  }

  function saveExpenses() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
      return true;
    } catch (_) {
      showError('Your expenses could not be saved in this browser. Please check available storage.');
      return false;
    }
  }

  function isValidDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00`);
    const [year, month, day] = value.split('-').map(Number);
    return !Number.isNaN(parsed.getTime()) &&
      parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
  }

  function formatCurrency(value) {
    return currencyFormatter.format(value);
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function clearError() {
    errorBox.textContent = '';
    errorBox.hidden = true;
  }

  function getSelectedExpenses() {
    return expenses.filter((expense) => expense.date.slice(0, 7) === monthInput.value);
  }

  function render() {
    const selected = getSelectedExpenses().sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    const total = selected.reduce((sum, expense) => sum + expense.amount, 0);
    const byCategory = selected.reduce((totals, expense) => {
      totals.set(expense.category, (totals.get(expense.category) || 0) + expense.amount);
      return totals;
    }, new Map());

    monthlyTotal.textContent = formatCurrency(total);
    expenseCount.textContent = `${selected.length} ${selected.length === 1 ? 'item' : 'items'}`;
    renderExpenses(selected);
    renderCategories(byCategory);
  }

  function renderExpenses(selected) {
    expenseList.replaceChildren();
    if (selected.length === 0) {
      expenseList.append(createEmptyState('No expenses for this month yet.'));
      return;
    }
    selected.forEach((expense) => {
      const item = document.createElement('article');
      item.className = 'expense-item';
      const details = document.createElement('div');
      const category = document.createElement('span');
      category.className = 'expense-name';
      category.textContent = expense.category;
      const metadata = document.createElement('span');
      metadata.className = 'expense-detail';
      metadata.textContent = expense.description ? `${expense.date} · ${expense.description}` : expense.date;
      details.append(category, metadata);

      const value = document.createElement('span');
      value.className = 'expense-amount';
      value.textContent = formatCurrency(expense.amount);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'delete-button';
      remove.textContent = 'Delete';
      remove.setAttribute('aria-label', `Delete ${expense.category} expense of ${formatCurrency(expense.amount)}`);
      remove.addEventListener('click', () => deleteExpense(expense.id));
      item.append(details, value, remove);
      expenseList.append(item);
    });
  }

  function renderCategories(byCategory) {
    categoryTotals.replaceChildren();
    if (byCategory.size === 0) {
      categoryTotals.append(createEmptyState('No category totals yet.'));
      return;
    }
    [...byCategory.entries()]
      .sort(([first], [second]) => first.localeCompare(second))
      .forEach(([category, total]) => {
        const row = document.createElement('div');
        row.className = 'category-row';
        const name = document.createElement('span');
        name.textContent = category;
        const value = document.createElement('strong');
        value.textContent = formatCurrency(total);
        row.append(name, value);
        categoryTotals.append(row);
      });
  }

  function createEmptyState(message) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = message;
    return empty;
  }

  function deleteExpense(id) {
    const previousExpenses = expenses;
    expenses = expenses.filter((expense) => expense.id !== id);
    if (!saveExpenses()) {
      expenses = previousExpenses;
      return;
    }
    render();
  }

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearError();
    const amount = Number(amountInput.value);
    const category = categoryInput.value.trim();
    const date = dateInput.value;
    const description = descriptionInput.value.trim();

    if (!Number.isFinite(amount) || amount <= 0) return showError('Enter an amount greater than 0 KZT.');
    if (!category) return showError('Enter an expense category.');
    if (!isValidDate(date)) return showError('Choose a valid expense date.');

    const expense = { id: createId(), amount, category, date, description };
    expenses.push(expense);
    if (!saveExpenses()) {
      expenses.pop();
      return;
    }
    form.reset();
    dateInput.value = todayIso();
    monthInput.value = expense.date.slice(0, 7);
    render();
  });

  monthInput.addEventListener('change', render);
  [amountInput, categoryInput, dateInput].forEach((input) => input.addEventListener('input', clearError));

  dateInput.value = todayIso();
  monthInput.value = currentMonth();
  render();
})();
