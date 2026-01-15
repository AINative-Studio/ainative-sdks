import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import dts from 'rollup-plugin-dts';

const external = ['react', 'next', 'next/server', 'next/headers', '@ainative/react-sdk'];

export default [
  // ESM and CommonJS builds
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.js',
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: 'dist/index.esm.js',
        format: 'esm',
        sourcemap: true,
      },
    ],
    external,
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
      }),
      terser(),
    ],
  },
  // Server utilities build
  {
    input: 'src/server/index.ts',
    output: [
      {
        file: 'dist/server.js',
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: 'dist/server.esm.js',
        format: 'esm',
        sourcemap: true,
      },
    ],
    external,
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
      }),
      terser(),
    ],
  },
  // Client utilities build
  {
    input: 'src/client/index.ts',
    output: [
      {
        file: 'dist/client.js',
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: 'dist/client.esm.js',
        format: 'esm',
        sourcemap: true,
      },
    ],
    external,
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
      }),
      terser(),
    ],
  },
  // Type definitions
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'esm',
    },
    external,
    plugins: [dts()],
  },
  // Server type definitions
  {
    input: 'src/server/index.ts',
    output: {
      file: 'dist/server.d.ts',
      format: 'esm',
    },
    external,
    plugins: [dts()],
  },
  // Client type definitions
  {
    input: 'src/client/index.ts',
    output: {
      file: 'dist/client.d.ts',
      format: 'esm',
    },
    external,
    plugins: [dts()],
  },
];
