import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  X,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  FileCode,
  Link as LinkIcon,
  Copy,
  Check,
  LogOut,
  Zap,
} from 'lucide-react';
import api from '../api/client';

export const GoogleFormsImportModal = ({ isOpen, onClose, onTestImported }) => {
  const navigate = useNavigate();

  // Tabs: 'url' | 'json'
  const [activeTab, setActiveTab] = useState('url');

  // Google status: { configured: bool, is_connected: bool, google_email: string, redirect_uri: string }
  const [googleStatus, setGoogleStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Form Inputs
  const [formUrl, setFormUrl] = useState('');
  const [jsonText, setJsonText] = useState('');

  // Execution states
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);

  // Instructions accordion
  const [showInstructions, setShowInstructions] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadStatus();
      setError('');
      setSuccessData(null);
    }
  }, [isOpen]);

  // Listen for popup OAuth success message
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        loadStatus();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const loadStatus = async () => {
    try {
      setLoadingStatus(true);
      const res = await api.get('/google/status');
      setGoogleStatus(res.data);
    } catch (err) {
      console.error('Ошибка проверки Google статуса:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleConnectGoogle = async () => {
    try {
      setError('');
      const redirectUri = window.location.origin + '/admin/google-callback';
      const res = await api.get(`/google/auth-url?redirect_uri=${encodeURIComponent(redirectUri)}`);
      const authUrl = res.data.auth_url;

      // Open in centered popup window
      const width = 540;
      const height = 640;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2.5;

      const popup = window.open(
        authUrl,
        'GoogleAuthPopup',
        `width=${width},height=${height},left=${left},top=${top},status=0,toolbar=0,location=0,menubar=0`
      );

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        // Fallback to full page redirect if popup blocked
        window.location.href = authUrl;
      }
    } catch (err) {
      setError(
        err.response?.data?.detail || 'Не удалось получить ссылку для авторизации в Google.'
      );
    }
  };

  const handleDisconnectGoogle = async () => {
    try {
      setSubmitting(true);
      await api.post('/google/disconnect');
      await loadStatus();
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось отключить аккаунт.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportByUrl = async (e) => {
    e.preventDefault();
    if (!formUrl.trim()) {
      setError('Пожалуйста, введите ссылку на Google Форму.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const res = await api.post('/google/import-form', {
        form_url_or_id: formUrl.trim(),
      });
      setSuccessData(res.data);
      if (onTestImported) onTestImported(res.data);
    } catch (err) {
      console.error('Ошибка импорта из Google Forms:', err);
      setError(err.response?.data?.detail || 'Не удалось импортировать тест из Google Формы.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportByJson = async (e) => {
    e.preventDefault();
    if (!jsonText.trim()) {
      setError('Пожалуйста, вставьте JSON код теста.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const res = await api.post('/google/import-json', {
        json_content: jsonText.trim(),
      });
      setSuccessData(res.data);
      if (onTestImported) onTestImported(res.data);
    } catch (err) {
      console.error('Ошибка импорта JSON:', err);
      setError(err.response?.data?.detail || 'Не удалось импортировать тест из JSON.');
    } finally {
      setSubmitting(false);
    }
  };

  const scriptCode = `function exportToLMS() {
  var form = FormApp.getActiveForm();
  var items = form.getItems();
  var payload = {
    info: { title: form.getTitle(), description: form.getDescription() },
    items: []
  };

  items.forEach(function(item) {
    var type = item.getType();
    if (type == FormApp.ItemType.MULTIPLE_CHOICE) {
      var q = item.asMultipleChoiceItem();
      payload.items.push({
        questionItem: {
          question: {
            choiceQuestion: {
              type: "RADIO",
              options: q.getChoices().map(function(c) { return { value: c.getValue() }; })
            },
            grading: {
              pointValue: q.getPoints() || 1,
              correctAnswers: { answers: q.getChoices().filter(function(c) { return c.isCorrectAnswer(); }).map(function(c) { return { value: c.getValue() }; }) }
            }
          }
        },
        title: item.getTitle(),
        description: item.getHelpText()
      });
    } else if (type == FormApp.ItemType.CHECKBOX) {
      var q = item.asCheckboxItem();
      payload.items.push({
        questionItem: {
          question: {
            choiceQuestion: {
              type: "CHECKBOX",
              options: q.getChoices().map(function(c) { return { value: c.getValue() }; })
            },
            grading: {
              pointValue: q.getPoints() || 1,
              correctAnswers: { answers: q.getChoices().filter(function(c) { return c.isCorrectAnswer(); }).map(function(c) { return { value: c.getValue() }; }) }
            }
          }
        },
        title: item.getTitle(),
        description: item.getHelpText()
      });
    } else if (type == FormApp.ItemType.TEXT || type == FormApp.ItemType.PARAGRAPH_TEXT) {
      payload.items.push({
        questionItem: {
          question: {
            textQuestion: { paragraph: type == FormApp.ItemType.PARAGRAPH_TEXT },
            grading: { pointValue: (item.asParagraphTextItem ? item.asParagraphTextItem().getPoints() : 1) || 1 }
          }
        },
        title: item.getTitle(),
        description: item.getHelpText()
      });
    }
  });

  Logger.log(JSON.stringify(payload));
}`;

  const copyScriptToClipboard = () => {
    navigator.clipboard.writeText(scriptCode);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  if (!isOpen) return null;

  const modalNode = (
    <div
      className="fixed inset-0 z-[9999] w-screen h-screen flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-backdrop select-none"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl border border-[#EEEEEE] shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh] transform transition-all animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-[#EEEEEE] flex items-center justify-between bg-linear-to-r from-[#7248B9]/5 via-white to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#7248B9]/10 border border-[#7248B9]/20 flex items-center justify-center text-[#7248B9]">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M19.321 5.562l-3.883-3.883C14.939 1.18 14.28 1 13.6 1H6.4C4.522 1 3 2.522 3 4.4v15.2C3 21.478 4.522 23 6.4 23h11.2c1.878 0 3.4-1.522 3.4-3.4V7.4c0-.68-.18-1.339-.679-1.838zM14 3.414L18.586 8H14V3.414zM19 19.6c0 .772-.628 1.4-1.4 1.4H6.4c-.772 0-1.4-.628-1.4-1.4V4.4c0-.772.628-1.4 1.4-1.4h6.6v6c0 .552.448 1 1 1h6v9.6zM8 12h8v2H8zm0 4h5v2H8z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-[#141414]">Импорт теста из Google Forms</h2>
              <p className="text-xs text-[#777777]">
                Перенос вопросов, вариантов, баллов и ключей правильных ответов
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#777777] hover:bg-[#F5F5F7] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Success View */}
          {successData ? (
            <div className="text-center py-6 space-y-4 animate-fade-in">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-[#141414]">Тест успешно импортирован!</h3>
                <p className="text-sm font-semibold text-[#7248B9]">«{successData.title}»</p>
              </div>

              <div className="bg-[#F5F5F7] rounded-2xl p-4 max-w-sm mx-auto flex items-center justify-around border border-[#EEEEEE]">
                <div>
                  <div className="text-xs text-[#777777]">Вопросов</div>
                  <div className="text-xl font-black text-[#141414] mt-0.5">
                    {successData.questions_count}
                  </div>
                </div>
                <div className="w-px h-8 bg-[#E0E0E0]" />
                <div>
                  <div className="text-xs text-[#777777]">Макс. баллов</div>
                  <div className="text-xl font-black text-emerald-600 mt-0.5">
                    {successData.total_points}
                  </div>
                </div>
              </div>

              <p className="text-xs text-[#777777] max-w-md mx-auto">
                Все вопросы, типы ответов, разбалловка и ключи правильных ответов успешно сохранены в LMS.
              </p>

              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate(`/admin/tests/${successData.test_id}`);
                  }}
                  className="btn-primary text-xs py-2.5 px-5 font-bold inline-flex items-center gap-2"
                >
                  <span>Открыть в конструкторе тестов</span>
                  <ExternalLink className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary text-xs py-2.5 px-4 font-bold"
                >
                  Закрыть
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Tab Selector */}
              <div className="flex items-center gap-1.5 p-1 bg-[#F5F5F7] rounded-xl border border-[#EEEEEE]">
                <button
                  type="button"
                  onClick={() => setActiveTab('url')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'url'
                      ? 'bg-white text-[#141414] shadow-xs'
                      : 'text-[#777777] hover:text-[#141414]'
                  }`}
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span>По ссылке Google Формы</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('json')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'json'
                      ? 'bg-white text-[#141414] shadow-xs'
                      : 'text-[#777777] hover:text-[#141414]'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Через JSON / Скрипт</span>
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3.5 rounded-2xl bg-[#FCECEB] border border-[#F8D3D0] text-[#E84C3D] text-xs font-semibold flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">{error}</div>
                </div>
              )}

              {/* TAB 1: BY URL & GOOGLE ACCOUNT */}
              {activeTab === 'url' && (
                <div className="space-y-4">
                  {/* Google Connection Status Banner */}
                  {loadingStatus ? (
                    <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-[#EEEEEE] text-center text-xs text-[#777777] flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-[#7248B9]" />
                      <span>Проверка подключения Google аккаунта...</span>
                    </div>
                  ) : googleStatus?.is_connected ? (
                    <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                          <Check className="w-4 h-4 stroke-[3]" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">
                            Google аккаунт подключен
                          </div>
                          <div className="text-xs font-bold text-emerald-950 truncate">
                            {googleStatus.google_email || 'Авторизован'}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleDisconnectGoogle}
                        disabled={submitting}
                        className="text-xs font-bold text-[#777777] hover:text-[#E84C3D] py-1 px-2.5 rounded-lg hover:bg-white transition-colors flex items-center gap-1 shrink-0"
                        title="Отключить этот Google аккаунт"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Отключить</span>
                      </button>
                    </div>
                  ) : (
                    <div className="p-5 rounded-2xl bg-[#FAF8FE] border border-[#E4D7F5] space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-white border border-[#D5C2ED] flex items-center justify-center shrink-0 shadow-2xs">
                          {/* Google 'G' Logo */}
                          <svg className="w-4 h-4" viewBox="0 0 24 24">
                            <path
                              fill="#4285F4"
                              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                            />
                            <path
                              fill="#34A853"
                              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"
                            />
                            <path
                              fill="#FBBC05"
                              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                            />
                            <path
                              fill="#EA4335"
                              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                            />
                          </svg>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-[#141414]">
                            Подключите Google для авто-импорта
                          </h4>
                          <p className="text-[11px] text-[#777777] leading-relaxed mt-0.5">
                            Система подключится к Google Forms API, чтобы считать форму со всеми
                            вопросами, вариантами, разбалловкой и правильными ответами.
                          </p>
                        </div>
                      </div>

                      {googleStatus?.configured ? (
                        <button
                          type="button"
                          onClick={handleConnectGoogle}
                          disabled={submitting}
                          className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-[#7248B9] hover:bg-[#5E36A4] text-white shadow-sm flex items-center justify-center gap-2 transition-colors"
                        >
                          <span>Войти через Google и разрешить доступ</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                            <strong>Настройка сервера:</strong> Для подключения через OAuth требуется
                            указать <code className="font-mono bg-white px-1 py-0.5 rounded">GOOGLE_CLIENT_ID</code> в файле <code className="font-mono bg-white px-1 py-0.5 rounded">.env</code> на сервере.
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowInstructions(!showInstructions)}
                            className="text-xs font-bold text-[#7248B9] hover:underline flex items-center gap-1"
                          >
                            <span>Как настроить ключи Google за 2 минуты</span>
                            {showInstructions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>

                          {showInstructions && (
                            <div className="p-3.5 rounded-xl bg-white border border-[#EEEEEE] text-[11px] text-[#777777] space-y-2 leading-relaxed">
                              <ol className="list-decimal list-inside space-y-1">
                                <li>Перейдите в <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-[#7248B9] font-bold underline">Google Cloud Console</a> и создайте проект.</li>
                                <li>В разделе «APIs & Services» включите <strong>Google Forms API</strong>.</li>
                                <li>Создайте учетные данные: <strong>OAuth 2.0 Client ID</strong> (тип: Web application).</li>
                                <li>
                                  В Authorized redirect URIs добавьте:{' '}
                                  <code className="font-mono bg-[#F5F5F7] text-[#141414] px-1 py-0.5 rounded text-[10px]">
                                    {googleStatus?.redirect_uri || window.location.origin + '/admin/google-callback'}
                                  </code>
                                </li>
                                <li>Впишите полученные ID и Secret в <code className="font-mono bg-[#F5F5F7] px-1 py-0.5 rounded">.env</code> на сервере.</li>
                              </ol>
                              <div className="pt-1 text-[#141414] font-semibold">
                                Либо вы можете переключиться на соседнюю вкладку <strong>«Через JSON / Скрипт»</strong> и импортировать тест прямо сейчас без ключей!
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Form URL Input */}
                  <form onSubmit={handleImportByUrl} className="space-y-4 pt-1">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-[#141414]">
                        Ссылка на Google Форму (с правами редактора или читателя):
                      </label>
                      <input
                        type="text"
                        value={formUrl}
                        onChange={(e) => setFormUrl(e.target.value)}
                        placeholder="https://docs.google.com/forms/d/1FAIpQLSc.../edit"
                        className="input-field text-xs w-full bg-white font-mono"
                      />
                      <p className="text-[11px] text-[#777777]">
                        Поддерживаются ссылки формата <code className="font-mono text-[10px] bg-[#F5F5F7] px-1 py-0.5 rounded">/edit</code> или идентификатор формы.
                      </p>
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-2.5">
                      <button
                        type="button"
                        onClick={onClose}
                        className="btn-secondary text-xs py-2.5 px-4 font-bold"
                      >
                        Отмена
                      </button>
                      <button
                        type="submit"
                        disabled={submitting || !googleStatus?.is_connected}
                        className="btn-primary text-xs py-2.5 px-6 font-bold flex items-center gap-2 bg-[#7248B9] hover:bg-[#5E36A4] disabled:opacity-50"
                      >
                        {submitting ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Импорт теста...</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-3.5 h-3.5" />
                            <span>Импортировать тест</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB 2: JSON / APPS SCRIPT FALLBACK */}
              {activeTab === 'json' && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-[#F0F5FA] border border-[#B8D5ED] text-[11px] text-[#141414] leading-relaxed space-y-2">
                    <div className="font-bold flex items-center gap-1.5 text-[#141414]">
                      <Zap className="w-4 h-4 text-[#7248B9]" />
                      <span>Импорт без настройки Google Cloud Console:</span>
                    </div>
                    <p className="text-[#555555]">
                      1. Откройте вашу Google Форму → меню из 3 точек вверху → <strong>«Редактор скриптов»</strong> (Apps Script).<br />
                      2. Вставьте скрипт ниже, нажмите «Выполнить» и скопируйте выведенный JSON в поле ввода.
                    </p>
                    <button
                      type="button"
                      onClick={copyScriptToClipboard}
                      className="btn-secondary text-[11px] py-1 px-3 rounded-lg font-bold inline-flex items-center gap-1.5 bg-white border-[#B8D5ED]"
                    >
                      {copiedScript ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-700">Скрипт скопирован!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Скопировать скрипт для Google Forms</span>
                        </>
                      )}
                    </button>
                  </div>

                  <form onSubmit={handleImportByJson} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-[#141414]">
                        Вставьте JSON структуру формы:
                      </label>
                      <textarea
                        rows={6}
                        value={jsonText}
                        onChange={(e) => setJsonText(e.target.value)}
                        placeholder={`{\n  "info": { "title": "Название теста" },\n  "items": [ ... ]\n}`}
                        className="input-field text-xs w-full bg-white font-mono resize-none leading-relaxed"
                      />
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-2.5">
                      <button
                        type="button"
                        onClick={onClose}
                        className="btn-secondary text-xs py-2.5 px-4 font-bold"
                      >
                        Отмена
                      </button>
                      <button
                        type="submit"
                        disabled={submitting || !jsonText.trim()}
                        className="btn-primary text-xs py-2.5 px-6 font-bold flex items-center gap-2 bg-[#7248B9] hover:bg-[#5E36A4] disabled:opacity-50"
                      >
                        {submitting ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Импорт теста...</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-3.5 h-3.5" />
                            <span>Импортировать из JSON</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
};
