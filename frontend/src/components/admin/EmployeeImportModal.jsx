import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Info,
  RefreshCw,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';

export const EmployeeImportModal = ({ isOpen, onClose, existingUsers = [], onSuccess }) => {
  const fileInputRef = useRef(null);

  const [step, setStep] = useState('upload'); // 'upload' | 'preview' | 'success'
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [importResult, setImportResult] = useState(null);

  if (!isOpen) return null;

  // 1. Download official Excel template
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Фамилия': 'Иванов',
        'Имя': 'Иван',
        'Почта': 'ivanov@amg.ru',
        'Категория': 1,
      },
      {
        'Фамилия': 'Петров',
        'Имя': 'Петр',
        'Почта': 'petrov@amg.ru',
        'Категория': 2,
      },
      {
        'Фамилия': 'Сидорова',
        'Имя': 'Анна',
        'Почта': 'sidorova@amg.ru',
        'Категория': 3,
      },
      {
        'Фамилия': 'Смирнов',
        'Имя': 'Алексей',
        'Почта': 'smirnov@amg.ru',
        'Категория': 4,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [
      { wch: 18 }, // Фамилия
      { wch: 18 }, // Имя
      { wch: 28 }, // Почта
      { wch: 12 }, // Категория
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Сотрудники');
    XLSX.writeFile(wb, 'Шаблон_импорта_сотрудников_AMG.xlsx');
  };

  // Helper to find column case-insensitively
  const findColumnValue = (row, candidates) => {
    const keys = Object.keys(row);
    for (const cand of candidates) {
      const match = keys.find((k) => k.trim().toLowerCase() === cand.toLowerCase());
      if (match && row[match] !== undefined && row[match] !== null) {
        return String(row[match]).trim();
      }
    }
    return '';
  };

  // 2. Parse uploaded file
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setServerError('');
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rawJson = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          setServerError('В загруженном файле не найдено строк с данными.');
          return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const newWarnings = [];
        const processedRows = [];

        // Build existing users fast lookup map
        const existingNamesMap = new Map();
        const existingEmailsMap = new Map();

        existingUsers.forEach((u) => {
          if (u.email) {
            existingEmailsMap.set(u.email.toLowerCase().trim(), u);
          }
          if (u.full_name) {
            const parts = u.full_name.toLowerCase().trim().split(/\s+/);
            if (parts.length >= 2) {
              existingNamesMap.set(`${parts[0]} ${parts[1]}`, u);
              existingNamesMap.set(`${parts[1]} ${parts[0]}`, u);
            } else if (parts.length === 1) {
              existingNamesMap.set(parts[0], u);
            }
          }
        });

        rawJson.forEach((row, idx) => {
          const rowNum = idx + 2; // considering header is row 1

          const lastName = findColumnValue(row, ['фамилия', 'last name', 'lastname', 'фамилия сотрудника']);
          const firstName = findColumnValue(row, ['имя', 'first name', 'firstname', 'имя сотрудника']);
          const email = findColumnValue(row, ['почта', 'email', 'e-mail', 'логин', 'электронная почта']);
          const rawCat = findColumnValue(row, ['категория', 'category', 'квалификация', 'уровень']);

          const hasName = Boolean(lastName || firstName);
          const hasEmail = Boolean(email);

          // Skip completely empty rows
          if (!hasName && !hasEmail && !rawCat) return;

          let isRowValid = true;
          let rowError = '';

          if (!lastName || !firstName) {
            isRowValid = false;
            rowError = 'Не указана Фамилия или Имя';
            newWarnings.push(`Строка ${rowNum}: отсутствует ${!lastName ? 'Фамилия' : 'Имя'}`);
          } else if (!hasEmail || !emailRegex.test(email)) {
            isRowValid = false;
            rowError = 'Некорректный или пустой email';
            newWarnings.push(`Строка ${rowNum} (${lastName} ${firstName}): не указан или некорректен email «${email}»`);
          }

          let category = 1;
          if (rawCat) {
            const parsedCat = parseInt(rawCat, 10);
            if (isNaN(parsedCat) || parsedCat < 1 || parsedCat > 4) {
              newWarnings.push(`Строка ${rowNum} (${lastName} ${firstName}): категория «${rawCat}» недопустима (допустимо 1-4). Установлена Категория 1.`);
              category = 1;
            } else {
              category = parsedCat;
            }
          }

          // Check if user already exists
          const lookupKey1 = `${lastName.toLowerCase()} ${firstName.toLowerCase()}`;
          const lookupKey2 = `${firstName.toLowerCase()} ${lastName.toLowerCase()}`;
          const matchedByName = existingNamesMap.get(lookupKey1) || existingNamesMap.get(lookupKey2);
          const matchedByEmail = email ? existingEmailsMap.get(email.toLowerCase()) : null;
          const matchedUser = matchedByName || matchedByEmail;

          let statusType = 'new';
          let statusText = 'Новый сотрудник';
          if (!isRowValid) {
            statusType = 'error';
            statusText = rowError;
          } else if (matchedUser) {
            statusType = 'update';
            statusText = `Обновление (${matchedUser.full_name})`;
          }

          processedRows.push({
            rowNum,
            last_name: lastName,
            first_name: firstName,
            email: email,
            category: category,
            isValid: isRowValid,
            statusType,
            statusText,
            matchedUser,
          });
        });

        if (processedRows.length === 0) {
          setServerError('Не удалось прочитать ни одного сотрудника. Проверьте названия колонок в файле.');
          return;
        }

        setParsedRows(processedRows);
        setWarnings(newWarnings);
        setStep('preview');
      } catch (err) {
        console.error('Ошибка чтения Excel:', err);
        setServerError('Ошибка чтения файла. Убедитесь, что это корректный файл Excel (.xlsx, .xls) или CSV.');
      }
    };

    reader.readAsBinaryString(file);
    // Reset file input value
    e.target.value = '';
  };

  // 3. Confirm and submit import
  const handleConfirmImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      setServerError('В файле нет корректных записей для импорта.');
      return;
    }

    try {
      setIsSubmitting(true);
      setServerError('');

      const payload = {
        employees: validRows.map((r) => ({
          last_name: r.last_name,
          first_name: r.first_name,
          email: r.email,
          category: r.category,
        })),
      };

      const res = await api.post('/users/bulk-import', payload);
      setImportResult(res.data);
      setStep('success');
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Ошибка импорта сотрудников:', err);
      setServerError(getErrorMessage(err, 'Не удалось выполнить импорт сотрудников.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const newCount = parsedRows.filter((r) => r.isValid && r.statusType === 'new').length;
  const updateCount = parsedRows.filter((r) => r.isValid && r.statusType === 'update').length;
  const errorCount = parsedRows.filter((r) => !r.isValid).length;

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] w-screen h-screen bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-backdrop select-none"
      onClick={onClose}
    >
      <div
        className="bg-white max-w-3xl w-full rounded-2xl border border-[#EEEEEE] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden transform transition-all animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#EEEEEE] p-5 shrink-0 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#222222]">
                Импорт сотрудников из Excel
              </h3>
              <p className="text-xs text-[#777777]">
                Массовое добавление и автоматическое обновление данных без дублей
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-[#777777] hover:text-[#222222] p-1.5 rounded-lg hover:bg-[#F5F5F7] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-5 flex-1">
          {serverError && (
            <div className="p-3.5 rounded-xl bg-[#FCECEB] border border-[#F8D3D0] flex items-start gap-2.5 text-[#E84C3D] text-xs animate-fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="flex-1 font-medium">{serverError}</span>
            </div>
          )}

          {/* STEP 1: Upload & Instructions */}
          {step === 'upload' && (
            <div className="space-y-5">
              {/* Template Download Card */}
              <div className="p-4 rounded-xl bg-[#F5F5F7] border border-[#EEEEEE] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-[#222222] block">
                    Официальный Excel-шаблон AMG
                  </span>
                  <p className="text-xs text-[#777777] leading-relaxed">
                    Скачайте готовый файл с настроенными колонками и примерами заполнения
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#EEEEEE] hover:bg-[#F5F5F7] text-xs font-bold text-[#141414] shadow-xs transition-colors shrink-0"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>Скачать шаблон (.xlsx)</span>
                </button>
              </div>

              {/* Instructions Box */}
              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-blue-950">
                  <Info className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>Инструкция по заполнению и правилам импорта</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] sm:text-xs text-blue-900/90 leading-relaxed pl-1">
                  <li>
                    <strong>Колонки файла:</strong> «Фамилия», «Имя», «Почта», «Категория» (регистр букв в заголовках не имеет значения).
                  </li>
                  <li>
                    <strong>Почта (Email):</strong> уникальный рабочий адрес сотрудника, служит логином для входа в LMS.
                  </li>
                  <li>
                    <strong>Категория:</strong> квалификационный уровень сотрудника (число от <strong>1 до 4</strong>). По умолчанию устанавливается 1.
                  </li>
                  <li>
                    <strong>Защита от дублей и автообновление:</strong> при повторном импорте данные существующих сотрудников определяются по <strong>Фамилии и Имени</strong> — их категория и почта обновятся автоматически, а вся история тестов и курсов сохранится.
                  </li>
                  <li>
                    <strong>Подтверждение:</strong> перед сохранением вы увидите полный предпросмотр всех найденных строк, статус каждой записи и предупреждения.
                  </li>
                </ul>
              </div>

              {/* Upload Dropzone */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#EEEEEE] hover:border-[#141414] rounded-2xl p-8 text-center cursor-pointer transition-all bg-[#F5F5F7] hover:bg-[#141414]/5 space-y-3 group flex flex-col items-center justify-center min-h-[170px]"
              >
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 group-hover:scale-110 transition-transform">
                  <Upload className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <span className="text-sm font-bold text-[#222222] block">
                    Нажмите для выбора файла или перетащите сюда
                  </span>
                  <span className="text-xs text-[#777777] block">
                    Поддерживаются форматы Excel (.xlsx, .xls) и CSV
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Preview & Warnings */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-[#F5F5F7] rounded-xl border border-[#EEEEEE] text-center">
                  <span className="text-[11px] font-bold text-[#777777] uppercase block">
                    В файле
                  </span>
                  <span className="text-xl font-black text-[#222222]">
                    {parsedRows.length}
                  </span>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                  <span className="text-[11px] font-bold text-emerald-800 uppercase block">
                    Новых
                  </span>
                  <span className="text-xl font-black text-emerald-700">
                    {newCount}
                  </span>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-center">
                  <span className="text-[11px] font-bold text-blue-800 uppercase block">
                    Обновятся
                  </span>
                  <span className="text-xl font-black text-blue-700">
                    {updateCount}
                  </span>
                </div>
                <div className={`p-3 rounded-xl border text-center ${errorCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-[#F5F5F7] border-[#EEEEEE]'}`}>
                  <span className={`text-[11px] font-bold uppercase block ${errorCount > 0 ? 'text-amber-800' : 'text-[#777777]'}`}>
                    Ошибок
                  </span>
                  <span className={`text-xl font-black ${errorCount > 0 ? 'text-amber-700' : 'text-[#777777]'}`}>
                    {errorCount}
                  </span>
                </div>
              </div>

              {/* Warnings Box */}
              {warnings.length > 0 && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1.5 max-h-36 overflow-y-auto">
                  <div className="flex items-center gap-1.5 font-bold text-amber-950">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Предупреждения при обработке файла ({warnings.length}):</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800/90 pl-1">
                    {warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preview Table */}
              <div className="border border-[#EEEEEE] rounded-xl overflow-hidden">
                <div className="max-h-64 overflow-y-auto overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-[#F5F5F7] text-[10px] font-bold uppercase tracking-wider text-[#777777] sticky top-0 border-b border-[#EEEEEE]">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">ФИО сотрудника</th>
                        <th className="py-2.5 px-3">Email (логин)</th>
                        <th className="py-2.5 px-3">Категория</th>
                        <th className="py-2.5 px-3 text-right">Действие</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EEEEEE]">
                      {parsedRows.map((r, i) => (
                        <tr
                          key={i}
                          className={
                            !r.isValid
                              ? 'bg-rose-50/50'
                              : r.statusType === 'update'
                              ? 'bg-blue-50/30'
                              : 'hover:bg-[#F5F5F7]/60'
                          }
                        >
                          <td className="py-2 px-3 text-[#777777] font-mono text-[11px]">
                            {r.rowNum}
                          </td>
                          <td className="py-2 px-3 font-semibold text-[#222222]">
                            {r.last_name || r.first_name ? `${r.last_name} ${r.first_name}`.trim() : <span className="text-rose-500 italic">Не указано</span>}
                          </td>
                          <td className="py-2 px-3 text-[#777777] font-mono text-[11px]">
                            {r.email || <span className="text-rose-500 italic">Отсутствует</span>}
                          </td>
                          <td className="py-2 px-3 font-semibold text-[#141414]">
                            Категория {r.category}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {r.statusType === 'new' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <UserPlus className="w-3 h-3 text-emerald-600" />
                                Новый
                              </span>
                            )}
                            {r.statusType === 'update' && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200"
                                title="Пользователь найден в системе по ФИО/email, данные будут обновлены"
                              >
                                <RefreshCw className="w-3 h-3 text-blue-600" />
                                Обновление
                              </span>
                            )}
                            {r.statusType === 'error' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <X className="w-3 h-3 text-rose-600" />
                                {r.statusText}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Success Screen */}
          {step === 'success' && importResult && (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-bold text-[#222222]">
                  Импорт сотрудников успешно завершен!
                </h4>
                <p className="text-xs text-[#777777]">
                  База пользователей AMG обновлена согласно загруженному файлу
                </p>
              </div>

              <div className="inline-flex items-center gap-4 bg-[#F5F5F7] px-6 py-3 rounded-2xl border border-[#EEEEEE] text-xs">
                <div>
                  <span className="text-[#777777] block text-[10px] uppercase font-bold">
                    Создано новых
                  </span>
                  <span className="text-base font-black text-emerald-600">
                    +{importResult.created_count}
                  </span>
                </div>
                <div className="w-px h-8 bg-[#CED4DA]" />
                <div>
                  <span className="text-[#777777] block text-[10px] uppercase font-bold">
                    Обновлено
                  </span>
                  <span className="text-base font-black text-blue-600">
                    {importResult.updated_count}
                  </span>
                </div>
                <div className="w-px h-8 bg-[#CED4DA]" />
                <div>
                  <span className="text-[#777777] block text-[10px] uppercase font-bold">
                    Всего обработано
                  </span>
                  <span className="text-base font-black text-[#141414]">
                    {importResult.total_processed}
                  </span>
                </div>
              </div>

              {importResult.warnings && importResult.warnings.length > 0 && (
                <div className="max-w-md mx-auto p-3 bg-amber-50 border border-amber-200 rounded-xl text-left text-xs text-amber-900 space-y-1">
                  <span className="font-bold block">Замечания при импорте:</span>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                    {importResult.warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#EEEEEE] p-4 bg-[#F5F5F7] flex items-center justify-between gap-2 shrink-0">
          {step === 'preview' ? (
            <button
              type="button"
              onClick={() => {
                setStep('upload');
                setParsedRows([]);
                setWarnings([]);
              }}
              disabled={isSubmitting}
              className="text-xs font-semibold text-[#777777] hover:text-[#222222] px-3 py-2 rounded-lg"
            >
              ← Выбрать другой файл
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {step !== 'success' ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="btn-secondary text-xs py-2 px-4 min-h-[40px]"
                >
                  Отмена
                </button>
                {step === 'preview' && (
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={isSubmitting || validCount === 0}
                    className="btn-primary text-xs py-2 px-5 min-h-[40px] flex items-center gap-2 font-bold disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Импорт в базу...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Подтвердить импорт ({validCount})</span>
                      </>
                    )}
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="btn-primary text-xs py-2 px-6 min-h-[40px] font-bold"
              >
                Закрыть
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
