(() => {
  const form = document.querySelector('#application-form');
  const saveDraftButton = document.querySelector('#save-draft');
  const message = document.querySelector('#form-message');
  const documentsInput = document.querySelector('#documents');
  const statusSteps = [...document.querySelectorAll('.status-steps li')];

  const DRAFT_KEY = 'urfu-material-help-draft';
  const MAX_FILE_SIZE = 20 * 1024 * 1024;
  const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

  const showMessage = (text) => {
    message.textContent = text;
  };

  const getFormData = () => {
    const data = {};
    new FormData(form).forEach((value, key) => {
      if (value instanceof File) return;
      data[key] = value;
    });
    data.consent = form.elements.consent.checked;
    return data;
  };

  const clearErrors = () => {
    form.querySelectorAll('.input-error').forEach((el) => {
      el.classList.remove('input-error');
    });
    form.querySelectorAll('.field-error').forEach((el) => el.remove());
  };

  const setError = (input, text) => {
    input.classList.add('input-error');
    const error = document.createElement('p');
    error.className = 'field-error';
    error.textContent = text;
    input.closest('.form-field, .consent-field')?.append(error);
  };

  const validateFiles = () => {
    const files = [...documentsInput.files];

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return `Файл «${file.name}» имеет неподдерживаемый формат.`;
      }
      if (file.size > MAX_FILE_SIZE) {
        return `Файл «${file.name}» превышает размер 20 МБ.`;
      }
    }
    return '';
  };

  const validate = () => {
    clearErrors();
    let valid = true;

    form.querySelectorAll('[required]').forEach((input) => {
      if (input.type === 'checkbox' && !input.checked) {
        setError(input, 'Необходимо подтвердить согласие.');
        valid = false;
      } else if (input.type !== 'checkbox' && !input.value.trim()) {
        setError(input, 'Заполните это поле.');
        valid = false;
      }
    });

    const fileError = validateFiles();
    if (fileError) {
      setError(documentsInput, fileError);
      valid = false;
    }

    return valid;
  };

  const setStep = (stepIndex) => {
    statusSteps.forEach((step, index) => {
      if (index === stepIndex) {
        step.setAttribute('aria-current', 'step');
      } else {
        step.removeAttribute('aria-current');
      }
    });
  };

  saveDraftButton.addEventListener('click', () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(getFormData()));
    showMessage('Черновик сохранён в этом браузере.');
  });

  const savedDraft = localStorage.getItem(DRAFT_KEY);
  if (savedDraft) {
    try {
      const data = JSON.parse(savedDraft);
      Object.entries(data).forEach(([name, value]) => {
        const input = form.elements[name];
        if (!input) return;
        if (input.type === 'checkbox') {
          input.checked = Boolean(value);
        } else {
          input.value = value;
        }
      });
      showMessage('Сохранённый черновик восстановлен.');
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    }
  }

  documentsInput.addEventListener('change', () => {
    const fileError = validateFiles();
    if (fileError) {
      clearErrors();
      setError(documentsInput, fileError);
      return;
    }
    clearErrors();
    showMessage(
      documentsInput.files.length
        ? `Выбрано файлов: ${documentsInput.files.length}.`
        : ''
    );
  });

  const successScreen = document.querySelector('#success-screen');
  const newApplicationButton = document.querySelector('#new-application');
  const backToFormButton = document.querySelector('#back-to-form');
  const applicationNumber = document.querySelector('#application-number');
  const applicationDate = document.querySelector('#application-date');

  const generateApplicationNumber = () => {
    const now = new Date();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `МП-${now.getFullYear()}-${random}`;
  };

  const formatDate = (date) =>
    new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'long',
      timeStyle: 'short'
    }).format(date);

  const showSuccessScreen = () => {
    form.closest('.application-form').hidden = true;
    successScreen.hidden = false;

    setStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetApplication = () => {
    form.reset();
    clearErrors();
    showMessage('');
    successScreen.hidden = true;
    form.closest('.application-form').hidden = false;
    setStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!validate()) {
      showMessage('Проверьте заполнение формы.');
      return;
    }

    try {
      const payload = new FormData(form);
      payload.set('consent', form.elements.consent.checked ? 'true' : 'false');

      const response = await fetch('/api/applications', {
        method: 'POST',
        body: payload
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Не удалось отправить заявление.');
      }

      localStorage.removeItem(DRAFT_KEY);
      applicationNumber.textContent = result.applicationNumber;
      applicationDate.textContent = formatDate(new Date(result.createdAt));
      showSuccessScreen();
    } catch (error) {
      showMessage(error.message || 'Ошибка соединения с сервером.');
    }
  });

  newApplicationButton.addEventListener('click', resetApplication);

  backToFormButton.addEventListener('click', () => {
    successScreen.hidden = true;
    form.closest('.application-form').hidden = false;
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();
