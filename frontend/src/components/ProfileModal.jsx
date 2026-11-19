import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Mail,
  Send,
  Bell,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  Loader2,
  AlertCircle,
  Unlink,
  RefreshCw,
  Sparkles,
  Award,
} from 'lucide-react';
import api, { getErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { RoleBadge } from './RoleBadge';

export const ProfileModal = ({ isOpen, onClose }) => {
  const { user, refreshUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [notifications, setNotifications] = useState({
    notify_email: true,
    notify_telegram: true,
    telegram_connected: false,
    telegram_username: null,
    bot_configured: false,
    bot_username: '',
  });

  // Telegram Code Generation State
  const [linkCodeData, setLinkCodeData] = useState(null); // { code, bot_username, deep_link, expires_in_seconds }
  const [generatingCode, setGeneratingCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const pollIntervalRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      loadNotificationSettings();
    } else {
      stopPolling();
      setLinkCodeData(null);
      setErrorMsg(null);
      setStatusMsg(null);
    }
    return () => stopPolling();
  }, [isOpen]);

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const loadNotificationSettings = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await api.get('/users/me/notifications');
      setNotifications(res.data);
    } catch (err) {
      console.error('Ошибка загрузки настроек уведомлений:', err);
      setErrorMsg('Не удалось загрузить настройки уведомлений.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key) => {
    const nextVal = !notifications[key];
    const prevVal = notifications[key];

    // Оптимистичное обновление
    setNotifications((prev) => ({ ...prev, [key]: nextVal }));

    try {
      setUpdating(true);
      const payload = { [key]: nextVal };
      const res = await api.put('/users/me/notifications', payload);
      setNotifications(res.data);
      if (refreshUser) refreshUser();
    } catch (err) {
      console.error('Ошибка сохранения настроек уведомлений:', err);
      setNotifications((prev) => ({ ...prev, [key]: prevVal }));
      alert(getErrorMessage(err, 'Не удалось сохранить настройку уведомлений.'));
    } finally {
      setUpdating(false);
    }
  };

  const handleGenerateTelegramCode = async () => {
    try {
      setGeneratingCode(true);
      setErrorMsg(null);
      const res = await api.post('/users/me/telegram/generate-code');
      setLinkCodeData(res.data);

      // Запускаем периодический опрос: подключил ли пользователь бота
      startPollingForConnection();
    } catch (err) {
      console.error('Ошибка генерации кода привязки Telegram:', err);
      setErrorMsg(getErrorMessage(err, 'Не удалось сгенерировать код привязки.'));
    } finally {
      setGeneratingCode(false);
    }
  };

  const startPollingForConnection = () => {
    stopPolling();
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await api.get('/users/me/notifications');
        if (res.data.telegram_connected) {
          stopPolling();
          setNotifications(res.data);
          setLinkCodeData(null);
          setStatusMsg('Telegram успешно подключен к вашему аккаунту!');
          if (refreshUser) refreshUser();
          setTimeout(() => setStatusMsg(null), 5000);
        }
      } catch (err) {
        // ignore polling errors
      }
    }, 2500);
  };

  const handleCopyCode = () => {
    if (!linkCodeData?.code) return;
    navigator.clipboard.writeText(linkCodeData.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUnlinkTelegram = async () => {
    if (!window.confirm('Отвязать ваш Telegram-аккаунт от платформы обучения? Вы перестанете получать уведомления в мессенджер.')) {
      return;
    }
    try {
      setUnlinking(true);
      setErrorMsg(null);
      await api.delete('/users/me/telegram');
      setNotifications((prev) => ({
        ...prev,
        telegram_connected: false,
        telegram_username: null,
        notify_telegram: false,
      }));
      if (refreshUser) refreshUser();
      setStatusMsg('Telegram успешно отключен.');
      setTimeout(() => setStatusMsg(null), 4000);
    } catch (err) {
      console.error('Ошибка отключения Telegram:', err);
      setErrorMsg(getErrorMessage(err, 'Не удалось отключить Telegram.'));
    } finally {
      setUnlinking(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#EEEEEE] overflow-hidden flex flex-col max-h-[92vh] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#EEEEEE] flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#141414] text-white flex items-center justify-center font-black text-sm shrink-0 shadow-sm">
              {user?.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-[#222222] truncate">
                  {user?.full_name || 'Профиль сотрудника'}
                </h2>
                <RoleBadge role={user?.role} className="scale-90 origin-left" />
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#E84C3D]/15 text-[#E84C3D] border border-[#E84C3D]/30 flex items-center gap-1">
                  <Award className="w-3 h-3 text-[#E84C3D]" />
                  <span>Категория {user?.category || 1}</span>
                </span>
              </div>
              <p className="text-xs text-[#777777] truncate mt-0.5">
                {user?.email} • {user?.department || 'Без отдела'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#777777] hover:text-[#222222] hover:bg-[#F5F5F7] transition-colors shrink-0"
            title="Закрыть"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-left">
          {/* Employee Category Info Card */}
          <div className="p-4 rounded-xl bg-[#F5F5F7] border border-[#EEEEEE] flex items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#777777] block">
                Квалификационная категория
              </span>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-base font-black text-[#222222]">
                  Категория {user?.category || 1}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white border border-[#EEEEEE] flex items-center justify-center text-[#E84C3D] shadow-xs shrink-0">
              <Award className="w-5 h-5" />
            </div>
          </div>

          {/* Status Banners */}
          {statusMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2.5 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span className="font-medium">{statusMsg}</span>
            </div>
          )}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-[#E84C3D] text-xs flex items-center gap-2.5 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section: Уведомления */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#EEEEEE] pb-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#777777]">
                <Bell className="w-4 h-4 text-[#141414]" />
                <span>Каналы оповещений и уведомлений</span>
              </div>
              {updating && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#777777]" />}
            </div>

            {loading ? (
              <div className="py-8 flex justify-center items-center gap-2 text-xs text-[#777777]">
                <Loader2 className="w-5 h-5 animate-spin text-[#141414]" />
                <span>Загрузка настроек...</span>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 1. Email Notifications */}
                <div className="p-4 rounded-xl bg-[#F5F5F7] border border-[#EEEEEE] flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-white border border-[#E0E0E0] flex items-center justify-center text-[#141414] shrink-0 mt-0.5">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-[#222222]">
                        Оповещения на почту (Email)
                      </div>
                      <p className="text-[11px] sm:text-xs text-[#777777] mt-0.5 leading-relaxed">
                        Письма о назначении новых курсов, аттестаций и рецензий на адрес{' '}
                        <span className="font-semibold text-[#222222]">{user?.email}</span>.
                      </p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                    <input
                      type="checkbox"
                      checked={Boolean(notifications.notify_email)}
                      onChange={() => handleToggle('notify_email')}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5.5 bg-[#CED4DA] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-[#141414]" />
                  </label>
                </div>

                {/* 2. Telegram Notifications */}
                <div className="p-4 rounded-xl bg-[#F5F5F7] border border-[#EEEEEE] space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[#2AABEE]/10 border border-[#2AABEE]/30 flex items-center justify-center text-[#2AABEE] shrink-0 mt-0.5">
                        <Send className="w-4 h-4 fill-current" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-bold text-[#222222]">
                            Уведомления в Telegram
                          </span>
                          {notifications.telegram_connected ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <Check className="w-3 h-3" />
                              Подключен
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-white text-[#777777] border border-[#EEEEEE]">
                              Не подключен
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] sm:text-xs text-[#777777] mt-0.5 leading-relaxed">
                          {notifications.telegram_connected
                            ? `Привязан аккаунт: ${
                                notifications.telegram_username
                                  ? `@${notifications.telegram_username}`
                                  : 'Telegram активен'
                              }. Оповещения приходят сразу на телефон.`
                            : 'Мгновенные оповещения о тестах, дедлайнах и результатах прямо в мессенджер.'}
                        </p>
                      </div>
                    </div>

                    {/* Toggle Switch (только если Telegram уже привязан) */}
                    {notifications.telegram_connected && (
                      <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                        <input
                          type="checkbox"
                          checked={Boolean(notifications.notify_telegram)}
                          onChange={() => handleToggle('notify_telegram')}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5.5 bg-[#CED4DA] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-[#2AABEE]" />
                      </label>
                    )}
                  </div>

                  {/* If CONNECTED: Option to Unlink */}
                  {notifications.telegram_connected ? (
                    <div className="pt-2 border-t border-[#E5E5E5] flex items-center justify-between">
                      <span className="text-[11px] text-[#777777]">
                        {notifications.notify_telegram
                          ? 'Уведомления включены'
                          : 'Уведомления временно приостановлены'}
                      </span>
                      <button
                        type="button"
                        onClick={handleUnlinkTelegram}
                        disabled={unlinking}
                        className="text-xs text-[#E84C3D] hover:underline font-semibold flex items-center gap-1.5"
                      >
                        {unlinking ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Unlink className="w-3.5 h-3.5" />
                        )}
                        <span>Отвязать Telegram</span>
                      </button>
                    </div>
                  ) : (
                    /* If NOT CONNECTED: Code Generation & Link Flow */
                    <div className="pt-2">
                      {!linkCodeData ? (
                        <div>
                          <button
                            type="button"
                            onClick={handleGenerateTelegramCode}
                            disabled={generatingCode}
                            className="btn-primary text-xs py-2 px-3.5 flex items-center gap-2 bg-[#2AABEE] hover:bg-[#2297D4] border-transparent shadow-xs text-white"
                          >
                            {generatingCode ? (
                              <Loader2 className="w-4 h-4 animate-spin text-white" />
                            ) : (
                              <Send className="w-3.5 h-3.5 fill-white" />
                            )}
                            <span>Подключить Telegram-бота</span>
                          </button>
                        </div>
                      ) : (
                        /* Active 4-Digit Code Card */
                        <div className="p-4 rounded-xl bg-white border border-[#2AABEE]/40 shadow-sm space-y-3 animate-fade-in">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#222222] flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-[#2AABEE]" />
                              Ваш 4-значный код подключения:
                            </span>
                            <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              Действует 15 минут
                            </span>
                          </div>

                          {/* 4-Digit High-Contrast Monospace Display */}
                          <div className="flex items-center gap-2 sm:gap-3 justify-center py-2">
                            {linkCodeData.code.split('').map((char, idx) => (
                              <div
                                key={idx}
                                className="w-12 h-14 rounded-xl bg-[#F5F5F7] border-2 border-[#141414] flex items-center justify-center text-2xl font-black text-[#141414] font-mono shadow-xs select-all"
                              >
                                {char}
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={handleCopyCode}
                              className="ml-2 p-2.5 rounded-xl border border-[#EEEEEE] hover:bg-[#F5F5F7] text-[#777777] hover:text-[#141414] transition-all"
                              title="Скопировать код"
                            >
                              {copied ? (
                                <Check className="w-5 h-5 text-emerald-600" />
                              ) : (
                                <Copy className="w-5 h-5" />
                              )}
                            </button>
                          </div>

                          {/* Instructions */}
                          <div className="text-[11px] sm:text-xs text-[#777777] space-y-1.5 bg-[#F5F5F7] p-3 rounded-lg border border-[#EEEEEE]">
                            <div>
                              <b>Шаг 1:</b> Откройте Telegram-бота{' '}
                              {linkCodeData.bot_username ? (
                                <span className="font-semibold text-[#141414]">
                                  @{linkCodeData.bot_username}
                                </span>
                              ) : (
                                'AMG LMS'
                              )}
                              .
                            </div>
                            <div>
                              <b>Шаг 2:</b> Нажмите <b>«Старт»</b> или отправьте ему этот 4-значный код{' '}
                              <span className="font-bold text-[#141414]">{linkCodeData.code}</span>.
                            </div>
                            <div className="text-emerald-700 font-semibold flex items-center gap-1.5 pt-1">
                              <RefreshCw className="w-3 h-3 animate-spin text-emerald-600" />
                              <span>Ожидаем подтверждения от бота (привяжется автоматически)...</span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 flex-wrap pt-1">
                            {linkCodeData.deep_link ? (
                              <a
                                href={linkCodeData.deep_link}
                                target="_blank"
                                rel="noreferrer"
                                className="flex-1 py-2 px-3 rounded-xl bg-[#2AABEE] hover:bg-[#2297D4] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
                              >
                                <Send className="w-3.5 h-3.5 fill-white" />
                                <span>Открыть бота в Telegram</span>
                                <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
                              </a>
                            ) : (
                              <div className="text-xs text-amber-700">
                                Укажите имя бота в Telegram для прямой ссылки.
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                stopPolling();
                                setLinkCodeData(null);
                              }}
                              className="py-2 px-3 rounded-xl border border-[#EEEEEE] text-xs font-semibold text-[#777777] hover:bg-[#F5F5F7] hover:text-[#222222]"
                            >
                              Отмена
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-[#EEEEEE] bg-[#F5F5F7] flex items-center justify-between">
          <span className="text-[11px] text-[#777777]">
            AMG LMS • Корпоративная система аттестации
          </span>
          <button
            type="button"
            onClick={onClose}
            className="btn-primary text-xs py-1.5 px-4"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
};
