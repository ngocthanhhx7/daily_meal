import React from "react";
import Svg, { Path } from "react-native-svg";

interface IconProps {
  size?: number;
  color?: string;
  style?: any;
}

export function CategoryIcon({ size = 24, color = "black", style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6 2C3.79086 2 2 3.79086 2 6V7C2 9.20914 3.79086 11 6 11H7C9.20914 11 11 9.20914 11 7V6C11 3.79086 9.20914 2 7 2H6ZM17 2C14.7909 2 13 3.79086 13 6V7C13 9.20914 14.7909 11 17 11H18C20.2091 11 22 9.20914 22 7V6C22 3.79086 20.2091 2 18 2H17ZM6 13C3.79086 13 2 14.7909 2 17V18C2 20.2091 3.79086 22 6 22H7C9.20914 22 11 20.2091 11 18V17C11 14.7909 9.20914 13 7 13H6ZM17 13C14.7909 13 13 14.7909 13 17V18C13 20.2091 14.7909 22 17 22H18C20.2091 22 22 20.2091 22 18V17C22 14.7909 20.2091 13 18 13H17Z"
        fill={color}
      />
    </Svg>
  );
}

export function KPIIcon({ size = 24, color = "black", style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7 2C4.23858 2 2 4.23858 2 7V17C2 19.7614 4.23858 22 7 22H17C19.7614 22 22 19.7614 22 17V7C22 4.23858 19.7614 2 17 2H7ZM13 8C13 7.44772 12.5523 7 12 7C11.4477 7 11 7.44772 11 8V16C11 16.5523 11.4477 17 12 17C12.5523 17 13 16.5523 13 16V8ZM8 10C8.55228 10 9 10.4477 9 11V16C9 16.5523 8.55229 17 8 17C7.44772 17 7 16.5523 7 16V11C7 10.4477 7.44772 10 8 10ZM16 12C16.5523 12 17 12.4477 17 13V16C17 16.5523 16.5523 17 16 17C15.4477 17 15 16.5523 15 16V13C15 12.4477 15.4477 12 16 12Z"
        fill={color}
      />
    </Svg>
  );
}

export function PostsIcon({ size = 24, color = "black", style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7 2C4.23858 2 2 4.23858 2 7V17C2 19.7614 4.23858 22 7 22H17C19.7614 22 22 19.7614 22 17V7C22 4.23858 19.7614 2 17 2H7ZM8 9C8 8.44772 8.44772 8 9 8C9.55228 8 10 8.44772 10 9C10 9.55229 9.55228 10 9 10C8.44772 10 8 9.55229 8 9ZM9 6C7.34315 6 6 7.34315 6 9C6 10.6569 7.34315 12 9 12C10.6569 12 12 10.6569 12 9C12 7.34315 10.6569 6 9 6ZM14.5063 14.2179C14.8541 13.7833 15.4892 13.7166 15.9194 14.0678L17.8409 15.7519C18.2562 16.116 18.888 16.0744 19.252 15.659C19.6161 15.2437 19.5745 14.6119 19.1591 14.2479L17.2173 12.5459L17.2077 12.538C15.9169 11.4622 13.9943 11.6564 12.9446 12.9685L11.3454 14.9675C11.0323 15.3589 10.4718 15.4459 10.0548 15.1679C8.78021 14.3182 7.06947 14.5791 6.10585 15.7671L4.7429 17.3466C4.38211 17.7648 4.42859 18.3962 4.84673 18.757C5.26487 19.1178 5.89633 19.0713 6.25713 18.6532L7.64315 17.0469L7.65476 17.0324C7.96789 16.641 8.52831 16.554 8.94538 16.832C10.2256 17.6855 11.9459 17.4184 12.9071 16.2169L14.5063 14.2179Z"
        fill={color}
      />
    </Svg>
  );
}

export function ReportsIcon({ size = 24, color = "black", style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12.8242 2.19551C12.2855 2.0416 11.7145 2.0416 11.1758 2.19551L6.17584 3.62408C4.88793 3.99205 4 5.16921 4 6.50865V11.8831C4 14.7897 5.40369 17.5173 7.76886 19.2067L10.2563 20.9834C11.2994 21.7285 12.7006 21.7285 13.7437 20.9834L16.2311 19.2067C18.5963 17.5173 20 14.7897 20 11.8831V6.50865C20 5.16921 19.1121 3.99205 17.8242 3.62408L12.8242 2.19551ZM15.6839 8.27046C16.0869 8.64819 16.1073 9.28103 15.7295 9.68394L11.9795 13.6839C11.6213 14.0661 11.0289 14.107 10.6215 13.7778L8.37148 11.9596C7.94192 11.6125 7.87508 10.9829 8.22221 10.5533C8.56933 10.1237 9.19896 10.0569 9.62852 10.404L11.1559 11.6383L14.2705 8.31606C14.6482 7.91315 15.281 7.89273 15.6839 8.27046Z"
        fill={color}
      />
    </Svg>
  );
}

export function PaymentsIcon({ size = 24, color = "black", style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2 8C2 5.79086 3.79086 4 6 4H18C20.2091 4 22 5.79086 22 8V8.5C22 8.77614 21.7761 9 21.5 9L2.5 9C2.22386 9 2 8.77614 2 8.5V8ZM2.5 11C2.22386 11 2 11.2239 2 11.5V16C2 18.2091 3.79086 20 6 20H18C20.2091 20 22 18.2091 22 16V11.5C22 11.2239 21.7761 11 21.5 11L2.5 11ZM13 15C13 14.4477 13.4477 14 14 14H17C17.5523 14 18 14.4477 18 15C18 15.5523 17.5523 16 17 16H14C13.4477 16 13 15.5523 13 15Z"
        fill={color}
      />
    </Svg>
  );
}

export function AiIcon({ size = 24, color = "black", style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M13.7137 3.90806C12.9363 2.61642 11.0637 2.61642 10.2864 3.90806L8.39925 7.04391L4.83371 7.86969C3.36509 8.20983 2.78642 9.99077 3.77464 11.1292L6.17384 13.893L5.85739 17.5392C5.72705 19.0411 7.24201 20.1418 8.63008 19.5537L12 18.126L15.37 19.5537C16.7581 20.1418 18.273 19.0411 18.1427 17.5392L17.8263 13.893L20.2254 11.1292C21.2137 9.99077 20.635 8.20983 19.1664 7.86969L15.6008 7.0439L13.7137 3.90806Z"
        fill={color}
      />
    </Svg>
  );
}

export function UserIcon({ size = 24, color = "black", style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9 14C6.23858 14 4 16.2386 4 19C4 20.6569 5.34315 22 7 22H17C18.6569 22 20 20.6569 20 19C20 16.2386 17.7614 14 15 14H9Z"
        fill={color}
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2Z"
        fill={color}
      />
    </Svg>
  );
}

export function AlertIcon({ size = 24, color = "black", style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM12 7C12.5523 7 13 7.44772 13 8V12C13 12.5523 12.5523 13 12 13C11.4477 13 11 12.5523 11 12V8C11 7.44772 11.4477 7 12 7ZM11 16C11 15.4477 11.4477 15 12 15H12.01C12.5623 15 13.01 15.4477 13.01 16C13.01 16.5523 12.5623 17 12.01 17H12C11.4477 17 11 16.5523 11 16Z"
        fill={color}
      />
    </Svg>
  );
}

export function BagIcon({ size = 24, color = "black", style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6.45925 6C4.02505 6 2.1552 8.15595 2.49945 10.5657L3.51965 17.7071C3.87155 20.1704 5.98115 22 8.4694 22H15.531C18.0193 22 20.1289 20.1704 20.4808 17.7071L21.501 10.5657C21.8452 8.15595 19.9754 6 17.5412 6H6.45925Z"
        fill={color}
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.44716 2.10554C9.94114 2.35253 10.1414 2.9532 9.89438 3.44718L8.10552 7.02489C7.85853 7.51887 7.25786 7.71909 6.76388 7.4721C6.2699 7.22511 6.06968 6.62444 6.31667 6.13046L8.10552 2.55275C8.35251 2.05877 8.95318 1.85855 9.44716 2.10554Z"
        fill={color}
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M14.5528 2.10552C15.0467 1.85853 15.6474 2.05876 15.8944 2.55273L17.6832 6.13044C17.9302 6.62442 17.73 7.22509 17.236 7.47208C16.7421 7.71907 16.1414 7.51885 15.8944 7.02487L14.1055 3.44716C13.8585 2.95318 14.0588 2.35251 14.5528 2.10552Z"
        fill={color}
      />
    </Svg>
  );
}

export function ClockIcon({ size = 24, color = "black", style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C9.23885 2 6.73748 3.12038 4.92893 4.92893C3.12038 6.73748 2 9.23885 2 12C2 14.7611 3.12038 17.2625 4.92893 19.0711C6.73748 20.8796 9.23885 22 12 22C14.7611 22 17.2625 20.8796 19.0711 19.0711C20.8796 17.2625 22 14.7611 22 12C22 9.23885 20.8796 6.73748 19.0711 4.92893C17.2625 3.12038 14.7611 2 12 2ZM12 7C12.5523 7 13 7.44772 13 8V11.5858L14.7071 13.2929C15.0976 13.6834 15.0976 14.3166 14.7071 14.7071C14.3166 15.0976 13.6834 15.0976 13.2929 14.7071L11.2929 12.7071C11.1054 12.5196 11 12.2652 11 12V8C11 7.44772 11.4477 7 12 7Z"
        fill={color}
      />
    </Svg>
  );
}

export function CompassIcon({ size = 24, color = "black", style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM15.9487 9.31626C16.0685 8.95692 15.975 8.56075 15.7071 8.29292C15.4393 8.02509 15.0431 7.93157 14.6838 8.05134L10.1838 9.55134C9.88519 9.65088 9.65088 9.88519 9.55134 10.1838L8.05134 14.6838C7.93157 15.0431 8.02509 15.4393 8.29292 15.7071C8.56075 15.975 8.95692 16.0685 9.31626 15.9487L13.8163 14.4487C14.1149 14.3492 14.3492 14.1149 14.4487 13.8163L15.9487 9.31626Z"
        fill={color}
      />
    </Svg>
  );
}

export function MessageIcon({ size = 24, color = "black", style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.47715 2 2 6.47715 2 12C2 13.8153 2.48451 15.5196 3.33127 16.9883C3.50372 17.2874 3.5333 17.6516 3.38777 17.9647L2.53406 19.8016C2.00986 20.7933 2.72736 22 3.86159 22H12C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2Z"
        fill={color}
      />
    </Svg>
  );
}

export function ArrowLeftIcon({ size = 24, color = "black", style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2ZM12.7071 7.29289C12.3166 6.90237 11.6834 6.90237 11.2929 7.29289L7.29289 11.2929C7.10536 11.4804 7 11.7348 7 12C7 12.2652 7.10536 12.5196 7.29289 12.7071L11.2929 16.7071C11.6834 17.0976 12.3166 17.0976 12.7071 16.7071C13.0976 16.3166 13.0976 15.6834 12.7071 15.2929L10.4142 13H16C16.5523 13 17 12.5523 17 12C17 11.4477 16.5523 11 16 11H10.4142L12.7071 8.70711C13.0976 8.31658 13.0976 7.68342 12.7071 7.29289Z"
        fill={color}
      />
    </Svg>
  );
}

export function RefreshIcon({ size = 24, color = "black", style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Path
        d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
        fill={color}
      />
    </Svg>
  );
}

export function LogoutIcon({ size = 24, color = "black", style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Path
        d="M17 8l-1.41 1.41L17.17 11H9v2h8.17l-1.58 1.58L17 16l4-4-4-4zM5 5h7V3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h7v-2H5V5z"
        fill={color}
      />
    </Svg>
  );
}
