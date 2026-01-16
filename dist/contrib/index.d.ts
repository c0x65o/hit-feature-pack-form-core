import React from 'react';
export type PackListWidgetRendererArgs = {
    entityKey: string;
    uiSpec: any;
    listSpec: any;
    navigate?: (path: string) => void;
    ui: any;
    platform: string;
    params: Record<string, string>;
};
export type PackDetailWidgetRendererArgs = {
    entityKey: string;
    uiSpec: any;
    detailSpec: any;
    navigate?: (path: string) => void;
    ui: any;
    platform: string;
    params: Record<string, string>;
};
export type PackFormWidgetRendererArgs = {
    entityKey: string;
    uiSpec: any;
    formSpec: any;
    navigate?: (path: string) => void;
    ui: any;
    platform: string;
    params: Record<string, string>;
};
export type PackContrib = {
    listWidgets?: Record<string, (args: PackListWidgetRendererArgs) => React.ReactNode>;
    detailWidgets?: Record<string, (args: PackDetailWidgetRendererArgs) => React.ReactNode>;
    formWidgets?: Record<string, (args: PackFormWidgetRendererArgs) => React.ReactNode>;
};
export declare const contrib: PackContrib;
export default contrib;
//# sourceMappingURL=index.d.ts.map