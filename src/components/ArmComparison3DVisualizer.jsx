import React from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";

function AxisHelper({ length = 0.1 }) {
  return (
    <group>
      <mesh>
        <cylinderGeometry args={[0.005, 0.005, length]} />
        <meshStandardMaterial color="red" />
      </mesh>
      <mesh rotation={[0, 0, -Math.PI / 2]} position={[0, 0, 0]}>
        <cylinderGeometry args={[0.005, 0.005, length]} />
        <meshStandardMaterial color="green" />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <cylinderGeometry args={[0.005, 0.005, length]} />
        <meshStandardMaterial color="blue" />
      </mesh>
    </group>
  );
}

function LinkX({ length = 0.1, color = "#3B82F6" }) {
  return (
    <mesh position={[length / 2, 0, 0]}>
      <boxGeometry args={[length, 0.05, 0.05]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function LinkZ({ length = 0.1, color = "#3B82F6" }) {
  return (
    <mesh position={[0, 0, length / 2]}>
      <cylinderGeometry args={[0.02, 0.02, length]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function buildDHChain(dhParams, jointAngles, color, showEndEffector = false) {
  const rad = (deg) => deg * (Math.PI / 180);

  let children = showEndEffector ? (
    <mesh position={[0, 0, 0]}>
      <sphereGeometry args={[0.03, 16, 16]} />
      <meshStandardMaterial color="yellow" />
    </mesh>
  ) : null;

  for (let i = dhParams.length - 1; i >= 0; i--) {
    const dh = dhParams[i];
    const theta = rad(jointAngles[i] + dh.theta);
    const alpha = rad(dh.alpha);
    const a = dh.a;
    const d = dh.d;

    children = (
      <group key={`joint-${i}`} rotation={[0, 0, theta]}>
        <group>
          {d !== 0 && <LinkZ length={Math.abs(d)} color={color} />}
          <group position={[0, 0, d]}>
            <group position={[a, 0, 0]} rotation={[alpha, 0, 0]}>
              <AxisHelper length={0.1} />
              {a !== 0 && <LinkX length={Math.abs(a)} color={color} />}
              {children}
            </group>
          </group>
        </group>
      </group>
    );
  }

  return children;
}

function RobotArm({
  jointAngles = [0, 0, 0, 0, 0, 0],
  basePosition = [0, 0, 0],
  color = "#3B82F6",
  showEndEffector = false,
}) {
  const dhParams = [
    { theta: 0, d: 0.089159, a: 0, alpha: 90 },
    { theta: 0, d: 0, a: -0.425, alpha: 0 },
    { theta: 0, d: 0, a: -0.39225, alpha: 0 },
    { theta: 0, d: 0.10915, a: 0, alpha: 90 },
    { theta: 0, d: 0.09465, a: 0, alpha: -90 },
    { theta: 0, d: 0.0823, a: 0, alpha: 0 },
  ];

  return (
    <group position={basePosition}>
      {buildDHChain(dhParams, jointAngles, color, showEndEffector)}
    </group>
  );
}

function ArmComparison3DVisualizer({
  masterJointAngles = [0, 0, 0, 0, 0, 0],
  slaveJointAngles = [0, 0, 0, 0, 0, 0],
}) {
  return (
    <div className="h-[400px] w-full bg-gray-100 rounded-lg overflow-hidden border border-gray-300">
      <Canvas camera={{ position: [4, 4, 4], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <OrbitControls />
        <Grid args={[10, 10]} />
        <RobotArm jointAngles={masterJointAngles} basePosition={[-0.5, 0, 0]} color="#3B82F6" showEndEffector={true} />
        <RobotArm jointAngles={slaveJointAngles} basePosition={[0.5, 0, 0]} color="#EF4444" showEndEffector={true} />
      </Canvas>
    </div>
  );
}

export default ArmComparison3DVisualizer;
