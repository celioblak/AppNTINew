import { Injectable, WritableSignal } from '@angular/core';
import { BehaviorSubject, share } from 'rxjs';

export interface MenuTag {
  color: string; // background color
  value: string;
}

export interface MenuPermissions {
  only?: string | string[];
  except?: string | string[];
}

export interface MenuChildrenItem {
  route: string;
  name: string;
  type: 'link' | 'sub' | 'extLink' | 'extTabLink';
  children?: MenuChildrenItem[];
  permissions?: MenuPermissions;
  active?: WritableSignal<boolean>;
}

export interface Menu {
  route: string;
  name: string;
  type: 'link' | 'sub' | 'extLink' | 'extTabLink';
  icon: string;
  label?: MenuTag;
  badge?: MenuTag;
  children?: MenuChildrenItem[];
  permissions?: MenuPermissions;
  active?: WritableSignal<boolean>;
}

@Injectable({
  providedIn: 'root',
})
export class MenuService {
  private readonly menu$ = new BehaviorSubject<Menu[]>([]);

  /** Get all the menu data. */
  getAll() {
    return this.menu$.asObservable();
  }

  /** Observe the change of menu data. */
  change() {
    return this.menu$.pipe(share());
  }

  /** Initialize the menu data. */
  set(menu: Menu[]) {
    this.menu$.next(menu);
    return this.menu$.asObservable();
  }

  /** Add one item to the menu data. */
  add(menu: Menu) {
    const tmpMenu = this.menu$.value;
    tmpMenu.push(menu);
    this.menu$.next(tmpMenu);
  }

  /** Reset the menu data. */
  reset() {
    this.menu$.next([]);
  }

  /** Delete empty values and rebuild route. */
  buildRoute(routeArr: string[]) {
    let route = '';
    routeArr.forEach(item => {
      if (item && item.trim()) {
        route += '/' + item.replace(/^\/+|\/+$/g, '');
      }
    });
    return route;
  }

  /** Get the menu item name based on current route. */
  getItemName(routeArr: string[]) {
    return this.getLevel(routeArr)[routeArr.length - 1];
  }

  // Whether is a leaf menu
  private isLeafItem(item: MenuChildrenItem) {
    const cond0 = item.route === undefined;
    const cond1 = item.children === undefined;
    const cond2 = !cond1 && item.children?.length === 0;
    return cond0 || cond1 || cond2;
  }

  // Deep clone object could be jsonized
  private deepClone(obj: any) {
    return JSON.parse(JSON.stringify(obj));
  }

  // Whether two objects could be jsonized equal
  private isJsonObjEqual(obj0: any, obj1: any) {
    return JSON.stringify(obj0) === JSON.stringify(obj1);
  }

  // Whether routeArr equals realRouteArr (after remove empty route element)
  private isRouteEqual(routeArr: string[], realRouteArr: string[]) {
    realRouteArr = this.deepClone(realRouteArr);
    realRouteArr = realRouteArr.filter(r => r !== '');
    return this.isJsonObjEqual(routeArr, realRouteArr);
  }

  /** Get the menu level. */
 /** Get the menu level. */
/** Get the menu level. */
getLevel(routeArr: string[]): string[] {
  // Caso base: sem rota ou menu vazio
  if (!routeArr?.length || !this.menu$.value?.length) {
    return [];
  }

  for (const rootItem of this.menu$.value) {
    // Camada inicial (itens raiz)
    let unhandledLayer: Array<{
      item: Menu | MenuChildrenItem;
      parentNamePathList: string[];
      realRouteArr: string[];
    }> = [{
      item: rootItem,
      parentNamePathList: [],
      realRouteArr: [],
    }];

    while (unhandledLayer.length > 0) {
      const nextUnhandledLayer: typeof unhandledLayer = [];

      for (const layer of unhandledLayer) {
        if (!layer?.item) {
          console.warn("Camada inválida:", layer);
          continue;
        }

        const { item, parentNamePathList, realRouteArr } = layer;

        const currentNamePath = [...parentNamePathList, item.name];
        const currentRealRoute = [...realRouteArr, item.route ?? ''];

        // Encontrou → retorna imediatamente
        if (this.isRouteEqual(routeArr, currentRealRoute)) {
          return currentNamePath;
        }

        // Processa filhos (somente se array válido)
        if (!this.isLeafItem(item) && Array.isArray(item.children) && item.children.length > 0) {
          const validChildren = item.children.filter(
            (child): child is MenuChildrenItem => child != null && typeof child === 'object'
          );

          const wrapped = validChildren.map(child => ({
            item: child,
            parentNamePathList: currentNamePath,
            realRouteArr: currentRealRoute,
          }));

          nextUnhandledLayer.push(...wrapped);
        }
      }

      unhandledLayer = nextUnhandledLayer;
    }
  }
  return [];
}

  /** Add namespace for translation. */
  addNamespace(menu: Menu[] | MenuChildrenItem[], namespace: string) {
    menu.forEach(menuItem => {
      menuItem.name = `${namespace}.${menuItem.name}`;
      if (menuItem.children && menuItem.children.length > 0) {
        this.addNamespace(menuItem.children, menuItem.name);
      }
    });
  }
}
