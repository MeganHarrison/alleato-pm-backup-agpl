"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { useCurrentUserProfile } from "@/hooks/use-current-user-profile";
import {
  createDefaultTemplateConfig,
  DevFormConfigs,
  DevTemplateFormConfig,
  FORM_DEV_CONFIG_STORAGE_KEY,
  getTemplateConfig,
} from "@/lib/create-project/form";

interface CreateProjectDevConfigContextValue {
  isDevAdmin: boolean;
  isCreateProjectRoute: boolean;
  selectedTemplate: string;
  setSelectedTemplate: (value: string) => void;
  devConfigs: DevFormConfigs<string>;
  activeTemplateConfig: DevTemplateFormConfig<string>;
  updateActiveTemplateConfig: (
    updater: (
      config: DevTemplateFormConfig<string>,
    ) => DevTemplateFormConfig<string>,
  ) => void;
  resetActiveTemplateConfig: () => void;
  clearAllDevFormConfigs: () => void;
}

const CreateProjectDevConfigContext = createContext<
  CreateProjectDevConfigContextValue | undefined
>(undefined);

export function CreateProjectDevConfigProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname()!;
  const isCreateProjectRoute = pathname?.startsWith("/create-project") ?? false;
  const { profile } = useCurrentUserProfile({ enabled: isCreateProjectRoute });
  const isDevAdmin = process.env.NODE_ENV === "development" &&
    profile?.isAdmin === true;

  const [selectedTemplate, setSelectedTemplate] = useState("standard");
  const [devConfigs, setDevConfigs] = useState<DevFormConfigs<string>>({});

  useEffect(() => {
    if (!isCreateProjectRoute || !isDevAdmin || typeof window === "undefined") {
      return;
    }

    try {
      const stored = window.localStorage.getItem(FORM_DEV_CONFIG_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as DevFormConfigs<string>;
      if (parsed && typeof parsed === "object") {
        setDevConfigs(parsed);
      }
    } catch {
      // Ignore corrupted storage
    }
  }, [isCreateProjectRoute, isDevAdmin]);

  useEffect(() => {
    if (!isCreateProjectRoute || !isDevAdmin || typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      FORM_DEV_CONFIG_STORAGE_KEY,
      JSON.stringify(devConfigs),
    );
  }, [devConfigs, isCreateProjectRoute, isDevAdmin]);

  const activeTemplateConfig = useMemo(
    () => getTemplateConfig(devConfigs, selectedTemplate),
    [devConfigs, selectedTemplate],
  );

  const updateActiveTemplateConfig = useCallback(
    (
      updater: (
        config: DevTemplateFormConfig<string>,
      ) => DevTemplateFormConfig<string>,
    ) => {
      setDevConfigs((prev) => {
        const current = getTemplateConfig(prev, selectedTemplate);
        return {
          ...prev,
          [selectedTemplate]: updater(current),
        };
      });
    },
    [selectedTemplate],
  );

  const resetActiveTemplateConfig = useCallback(() => {
    setDevConfigs((prev) => ({
      ...prev,
      [selectedTemplate]: createDefaultTemplateConfig(selectedTemplate),
    }));
  }, [selectedTemplate]);

  const clearAllDevFormConfigs = useCallback(() => {
    setDevConfigs({});
  }, []);

  const value = useMemo(
    () => ({
      isDevAdmin,
      isCreateProjectRoute,
      selectedTemplate,
      setSelectedTemplate,
      devConfigs,
      activeTemplateConfig,
      updateActiveTemplateConfig,
      resetActiveTemplateConfig,
      clearAllDevFormConfigs,
    }),
    [
      isDevAdmin,
      isCreateProjectRoute,
      selectedTemplate,
      devConfigs,
      activeTemplateConfig,
      updateActiveTemplateConfig,
      resetActiveTemplateConfig,
      clearAllDevFormConfigs,
    ],
  );

  return (
    <CreateProjectDevConfigContext.Provider value={value}>
      {children}
    </CreateProjectDevConfigContext.Provider>
  );
}

export function useCreateProjectDevConfig() {
  const context = useContext(CreateProjectDevConfigContext);
  if (!context) {
    throw new Error(
      "useCreateProjectDevConfig must be used inside CreateProjectDevConfigProvider",
    );
  }
  return context;
}

/** Safe variant that returns null when outside the provider (e.g. sidebar dev panel). */
export function useCreateProjectDevConfigOptional() {
  return useContext(CreateProjectDevConfigContext) ?? null;
}
