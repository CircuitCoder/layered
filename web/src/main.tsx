import {
  init,
  classModule,
  propsModule,
  styleModule,
  eventListenersModule,
  jsx
} from "snabbdom";

const patch = init([
  classModule,
  propsModule,
  styleModule,
  eventListenersModule
]);

function bootstrap() {
  const hello = <h1>Hello World</h1>;
  patch(document.getElementById("app")!, hello);
}

document.addEventListener('DOMContentLoaded', bootstrap);