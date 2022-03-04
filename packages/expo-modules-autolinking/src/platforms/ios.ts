import glob from 'fast-glob';
import fs from 'fs-extra';
import path from 'path';

import {
  ModuleDescriptorIos,
  ModuleIosPodspecInfo,
  PackageRevision,
  SearchOptions,
} from '../types';

async function findPodspecFiles(revision: PackageRevision): Promise<string[]> {
  const configPodspecPaths = revision.config?.iosPodspecPaths();
  if (configPodspecPaths && configPodspecPaths.length) {
    return configPodspecPaths;
  }

  const searchPath = revision.isExpoAdapter ? path.join(revision.path, 'expo') : revision.path;
  const podspecFiles = await glob('*/*.podspec', {
    cwd: searchPath,
    ignore: ['**/node_modules/**'],
  });

  return podspecFiles;
}

export function getSwiftModuleNames(
  pods: ModuleIosPodspecInfo[],
  swiftModuleNames: string[] | undefined
): string[] {
  if (swiftModuleNames && swiftModuleNames.length) {
    return swiftModuleNames;
  }
  // by default, non-alphanumeric characters in the pod name are replaced by _ in the module name
  return pods.map((pod) => pod.podName.replace(/[^a-zA-Z0-9]/g, '_'));
}

/**
 * Resolves module search result with additional details required for iOS platform.
 */
export async function resolveModuleAsync(
  packageName: string,
  revision: PackageRevision,
  options: SearchOptions
): Promise<ModuleDescriptorIos | null> {
  const podspecFiles = await findPodspecFiles(revision);
  if (!podspecFiles.length) {
    return null;
  }

  const searchPath = revision.isExpoAdapter ? path.join(revision.path, 'expo') : revision.path;
  const pods = podspecFiles.map((podspecFile) => ({
    podName: path.basename(podspecFile, path.extname(podspecFile)),
    podspecDir: path.dirname(path.join(searchPath, podspecFile)),
  }));

  const swiftModuleNames = getSwiftModuleNames(pods, revision.config?.iosSwiftModuleNames());

  return {
    packageName,
    pods,
    swiftModuleNames,
    flags: options.flags,
    modules: revision.config?.iosModules() ?? [],
    appDelegateSubscribers: revision.config?.iosAppDelegateSubscribers() ?? [],
    reactDelegateHandlers: revision.config?.iosReactDelegateHandlers() ?? [],
  };
}

/**
 * Generates Swift file that contains all autolinked Swift packages.
 */
export async function generatePackageListAsync(
  modules: ModuleDescriptorIos[],
  targetPath: string
): Promise<void> {
  const className = path.basename(targetPath, path.extname(targetPath));
  const generatedFileContent = await generatePackageListFileContentAsync(modules, className);

  await fs.outputFile(targetPath, generatedFileContent);
}

/**
 * Generates the string to put into the generated package list.
 */
async function generatePackageListFileContentAsync(
  modules: ModuleDescriptorIos[],
  className: string
): Promise<string> {
  const modulesToImport = modules.filter(
    (module) =>
      module.modules.length ||
      module.appDelegateSubscribers.length ||
      module.reactDelegateHandlers.length
  );
  const swiftModules = ([] as string[])
    .concat(...modulesToImport.map((module) => module.swiftModuleNames))
    .filter(Boolean);

  const modulesClassNames = ([] as string[])
    .concat(...modulesToImport.map((module) => module.modules))
    .filter(Boolean);

  const appDelegateSubscribers = ([] as string[]).concat(
    ...modulesToImport.map((module) => module.appDelegateSubscribers)
  );

  const reactDelegateHandlerModules = modulesToImport.filter(
    (module) => !!module.reactDelegateHandlers.length
  );

  return `/**
 * Automatically generated by expo-modules-autolinking.
 *
 * This autogenerated class provides a list of classes of native Expo modules,
 * but only these that are written in Swift and use the new API for creating Expo modules.
 */

import ExpoModulesCore
${swiftModules.map((moduleName) => `import ${moduleName}\n`).join('')}
@objc(${className})
public class ${className}: ModulesProvider {
  public override func getModuleClasses() -> [AnyModule.Type] {
    return ${formatArrayOfClassNames(modulesClassNames)}
  }

  public override func getAppDelegateSubscribers() -> [ExpoAppDelegateSubscriber.Type] {
    return ${formatArrayOfClassNames(appDelegateSubscribers)}
  }

  public override func getReactDelegateHandlers() -> [ExpoReactDelegateHandlerTupleType] {
    return ${formatArrayOfReactDelegateHandler(reactDelegateHandlerModules)}
  }
}
`;
}

/**
 * Formats an array of class names to Swift's array containing these classes.
 */
function formatArrayOfClassNames(classNames: string[]): string {
  const indent = '  ';
  return `[${classNames.map((className) => `\n${indent.repeat(3)}${className}.self`).join(',')}
${indent.repeat(2)}]`;
}

/**
 * Formats an array of modules to Swift's array containing ReactDelegateHandlers
 */
export function formatArrayOfReactDelegateHandler(modules: ModuleDescriptorIos[]): string {
  const values: string[] = [];
  for (const module of modules) {
    for (const handler of module.reactDelegateHandlers) {
      values.push(`(packageName: "${module.packageName}", handler: ${handler}.self)`);
    }
  }
  const indent = '  ';
  return `[${values.map((value) => `\n${indent.repeat(3)}${value}`).join(',')}
${indent.repeat(2)}]`;
}
