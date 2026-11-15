import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import api from '../../api/client';

export const GoogleOAuthCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing'); // 'processing' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setErrorMessage(`Google вернул ошибку авторизации: ${error}`);
      return;
    }

    if (!code) {
      setStatus('error');
      setErrorMessage('В ответе Google отсутствует код авторизации.');
      return;
    }

    exchangeCode(code);
  }, [searchParams]);

  const exchangeCode = async (code) => {
    try {
      const redirectUri = window.location.origin + '/admin/google-callback';
      const res = await api.post('/google/exchange-code', {
        code,
        redirect_uri: redirectUri,
      });

      setStatus('success');

      // If opened in popup, notify opener window and close
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage(
            {
              type: 'GOOGLE_AUTH_SUCCESS',
              email: res.data.google_email,
            },
            '*'
          );
          setTimeout(() => {
            window.close();
          }, 800);
          return;
        } catch {
          // fallback if postMessage blocked
        }
      }

      // If standalone redirect
      setTimeout(() => {
        navigate('/admin/tests?google_connected=true');
      }, 1500);
    } catch (err) {
      console.error('Ошибка обмена кода Google OAuth:', err);
      setStatus('error');
      setErrorMessage(
        err.response?.data?.detail || 'Не удалось завершить подключение Google аккаунта.'
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-[#EEEEEE] shadow-lg max-w-md w-full p-8 text-center space-y-5">
        {status === 'processing' && (
          <>
            <RefreshCw className="w-12 h-12 text-[#7248B9] animate-spin mx-auto" />
            <h2 className="text-lg font-bold text-[#141414]">Подключение Google аккаунта...</h2>
            <p className="text-xs text-[#777777]">
              Пожалуйста, подождите, идет обмен данными с Google сервисом.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-[#141414]">Google аккаунт успешно подключен!</h2>
            <p className="text-xs text-[#777777]">
              Окно закроется автоматически через секунду...
            </p>
            <button
              onClick={() => {
                if (window.opener) window.close();
                else navigate('/admin/tests');
              }}
              className="btn-primary text-xs py-2 px-5 font-bold mx-auto"
            >
              Вернуться к тестам
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-14 h-14 bg-[#FCECEB] rounded-full flex items-center justify-center mx-auto text-[#E84C3D]">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-[#141414]">Ошибка подключения</h2>
            <p className="text-xs text-[#E84C3D] bg-[#FCECEB] p-3 rounded-xl border border-[#F8D3D0]">
              {errorMessage}
            </p>
            <button
              onClick={() => {
                if (window.opener) window.close();
                else navigate('/admin/tests');
              }}
              className="btn-secondary text-xs py-2 px-5 font-bold mx-auto"
            >
              Закрыть
            </button>
          </>
        )}
      </div>
    </div>
  );
};
