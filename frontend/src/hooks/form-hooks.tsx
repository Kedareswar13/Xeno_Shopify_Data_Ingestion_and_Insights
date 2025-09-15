import { 
  useForm as useReactHookForm, 
  FormProvider as ReactHookFormProvider, 
  useFormContext as useRHFormContext,
  type UseFormReturn,
  type FieldValues,
  type SubmitHandler,
  type UseFormProps,
  type FormProviderProps,
  type DefaultValues,
  type FieldErrors,
  type SubmitErrorHandler,
  type UseFormSetError,
  type UseFormReset,
  type UseFormHandleSubmit,
  type UseFormRegister,
  type Control,
  type UseFormWatch,
  type UseFormSetValue,
  type UseFormGetValues,
  type UseFormTrigger,
  type FormState,
  type DeepPartial,
  type UseFormClearErrors,
  type UseFormSetFocus
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { type ReactNode, type ComponentProps, type ReactElement } from 'react';

type FormValues = FieldValues;

type DeepPartialOrUndefined<T> = T extends object ? {
  [K in keyof T]?: DeepPartialOrUndefined<T[K]>;
} : T;

export interface UseFormReturnType<T extends FormValues> extends UseFormReturn<T> {
  setServerErrors: (errors: Record<string, string>) => void;
  resetForm: (values?: DeepPartialOrUndefined<T>) => void;
  formState: FormState<T> & {
    defaultValues?: DeepPartial<T>;
  };
}

export function useForm<T extends FormValues>(
  schema: z.ZodSchema<T>,
  options?: UseFormProps<T>
): UseFormReturnType<T> {
  const form = useReactHookForm<T>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    criteriaMode: 'all',
    shouldFocusError: true,
    ...options,
  });

  const setServerErrors = (errors: Record<string, string>) => {
    Object.entries(errors).forEach(([field, message]) => {
      form.setError(field as any, {
        type: 'server',
        message,
      });
    });
  };

  const resetForm = (values?: DeepPartialOrUndefined<T>) => {
    form.reset(values as any);
  };

  return {
    ...form,
    setServerErrors,
    resetForm,
    formState: {
      ...form.formState,
      defaultValues: options?.defaultValues as DeepPartial<T> | undefined,
    },
  };
}

export function FormProvider<T extends FormValues>({ 
  children, 
  ...props 
}: { children: ReactNode } & FormProviderProps<T>) {
  return (
    <ReactHookFormProvider {...props}>
      {children}
    </ReactHookFormProvider>
  );
}

interface FormProps<T extends FormValues> extends Omit<ComponentProps<'form'>, 'onSubmit' | 'children' | 'onError'> {
  children: ReactNode | ((methods: UseFormReturnType<T>) => ReactNode);
  form: UseFormReturnType<T>;
  onSubmit: SubmitHandler<T>;
  onError?: SubmitErrorHandler<T>;
  className?: string;
  id?: string;
  noValidate?: boolean;
}

export function Form<T extends FormValues>({
  children,
  form,
  onSubmit,
  onError,
  className = '',
  id,
  noValidate = true,
  ...rest
}: FormProps<T>): ReactElement {
  const { handleSubmit } = form;

  return (
    <form
      {...rest}
      onSubmit={handleSubmit(onSubmit, onError)}
      className={className}
      id={id}
      noValidate={noValidate}
    >
      <FormProvider {...form}>
        {typeof children === 'function' ? children(form) : children}
      </FormProvider>
    </form>
  );
}

// Helper to avoid TSX generic arrow parsing issues
function arrayOf<T extends z.ZodTypeAny>(item: T, message = 'This field is required') {
  return z.array(item).min(1, { message });
}

export const validation = {
  email: (message = 'Please enter a valid email') =>
    z.string().email({ message }),
  password: (message = 'Password must be at least 8 characters') =>
    z.string().min(8, { message }),
  required: (message = 'This field is required') =>
    z.string().min(1, { message }),
  minLength: (length: number, message: string) =>
    z.string().min(length, { message }),
  maxLength: (length: number, message: string) =>
    z.string().max(length, { message }),
  url: (message = 'Please enter a valid URL') =>
    z.string().url({ message }),
  number: (message = 'Please enter a valid number') =>
    z.number({ invalid_type_error: message }),
  boolean: (message = 'This field is required') =>
    z.boolean().refine((val) => val === true, { message }),
  array: arrayOf,
  name: (message = 'Please enter a valid name') =>
    z.string().min(2, { message }),
  otp: (length = 6, message = `Must be ${length} digits`) =>
    z.string().length(length, { message }).regex(/^\d+$/, { message: 'Must contain only digits' }),
};

// Export the form context hook
export const useFormContext = useRHFormContext;

// Export types
export type { 
  FieldValues, 
  SubmitHandler, 
  SubmitErrorHandler, 
  UseFormReturn, 
  UseFormProps,
  DefaultValues,
  FieldErrors,
  UseFormSetError,
  UseFormReset,
  UseFormHandleSubmit,
  UseFormRegister,
  Control,
  UseFormWatch,
  UseFormSetValue,
  UseFormGetValues,
  UseFormTrigger,
  FormState,
  DeepPartial,
  UseFormClearErrors,
  UseFormSetFocus,
  UseFormResetField,
  UseFormGetFieldState,
  UseFormUnregister,
  FieldPath
} from 'react-hook-form';

export type { z } from 'zod';
